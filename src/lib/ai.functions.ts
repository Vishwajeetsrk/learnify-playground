import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";

const DebugInput = z.object({
  language: z.string().min(1).max(50),
  code: z.string().min(1).max(20000),
  stdout: z.string().max(20000).optional().default(""),
  stderr: z.string().max(20000).optional().default(""),
  exitCode: z.number().nullable().optional().default(null),
  provider: z.string().max(50).optional().default(""),
  stdin: z.string().max(10000).optional().default(""),
  question: z.string().max(2000).optional().default(""),
  userApiKey: z.string().max(200).optional().default(""),
});

// Ordered free-tier fallbacks on OpenRouter. We try them in order until one
// returns endpoints / succeeds.
const FALLBACK_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-chat-v3.1:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
] as const;

function buildProvider(key: string) {
  return createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    headers: {
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://polyglot-orbit.app",
      "X-Title": "Polyglot Orbit Playground",
    },
  });
}

function redactKey(k: string) {
  if (!k) return "(none)";
  return `${k.slice(0, 6)}…${k.slice(-4)} (${k.length} chars)`;
}

function isNoEndpointsError(msg: string) {
  return /no endpoints found|not a valid model|model_not_found|404/i.test(msg);
}

// Cheap endpoint availability probe — OpenRouter returns the provider list
// for a model id; if `data` is empty there are no endpoints today.
async function hasEndpoints(model: string, key: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://openrouter.ai/api/v1/models/${encodeURIComponent(model)}/endpoints`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) return false;
    const body = (await res.json()) as { data?: { endpoints?: unknown[] } };
    return Array.isArray(body?.data?.endpoints) && body.data!.endpoints!.length > 0;
  } catch {
    // Network/probe failure shouldn't block the real call — assume available.
    return true;
  }
}

export const debugCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => DebugInput.parse(input))
  .handler(async ({ data }) => {
    const system = `You are a concise senior engineer helping a developer debug code in an online Playground.
- Identify the root cause from the code, stderr, exit code, stdin, and provider notes.
- Suggest a minimal fix. Always include the COMPLETE corrected program in ONE fenced code block tagged with the language (e.g. \`\`\`python). The Playground's "Apply fix" button replaces the editor with that block, so it must compile/run standalone.
- After the code block, add 1-3 short bullet points explaining what changed and why.
- If the code already runs cleanly, suggest one improvement and still include the full updated program.
- Keep prose under 200 words. Use markdown.`;

    const ctx = [
      `Language: ${data.language}`,
      `Executor: ${data.provider || "unknown"}`,
      `Exit code: ${data.exitCode ?? "n/a"}`,
    ].join(" · ");

    const user = `${ctx}

CODE:
\`\`\`${data.language}
${data.code}
\`\`\`

STDIN:
\`\`\`
${data.stdin || "(none)"}
\`\`\`

STDOUT:
\`\`\`
${data.stdout || "(empty)"}
\`\`\`

STDERR:
\`\`\`
${data.stderr || "(empty)"}
\`\`\`

${data.question ? `USER QUESTION: ${data.question}` : "Diagnose any issue and return the full fixed program."}`;

    const messages = [
      { role: "system" as const, content: system },
      { role: "user" as const, content: user },
    ];

    const userKey = data.userApiKey?.trim();
    const envKey = process.env.OPENROUTER_API_KEY?.trim();
    const key = userKey || envKey;
    const reqId = `ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    if (!key) {
      throw new Error(
        "AI is not configured. Click 'Your key' to add your OpenRouter API key and try again.",
      );
    }

    const provider = buildProvider(key);
    const attempts: { model: string; ok: boolean; ms: number; error?: string }[] = [];

    console.log("[ai/debug] request", {
      reqId,
      language: data.language,
      codeBytes: data.code.length,
      stderrBytes: data.stderr.length,
      exitCode: data.exitCode,
      executor: data.provider,
      keySource: userKey ? "user-byo" : "env",
      key: redactKey(key),
    });

    let lastError: unknown = null;

    for (const model of FALLBACK_MODELS) {
      const t0 = Date.now();
      // Endpoint availability gate — avoids the noisy "No endpoints found" path.
      const available = await hasEndpoints(model, key);
      if (!available) {
        const ms = Date.now() - t0;
        attempts.push({ model, ok: false, ms, error: "no endpoints" });
        console.warn("[ai/debug] skip model (no endpoints)", { reqId, model, ms });
        continue;
      }

      try {
        const { text } = await generateText({ model: provider(model), messages });
        const ms = Date.now() - t0;
        attempts.push({ model, ok: true, ms });
        console.log("[ai/debug] success", { reqId, model, ms, replyBytes: text.length, attempts });
        return {
          reply: text,
          source: userKey ? ("openrouter-user" as const) : ("openrouter-env" as const),
          model,
          reqId,
          attempts,
        };
      } catch (err) {
        const ms = Date.now() - t0;
        const message = err instanceof Error ? err.message : String(err);
        attempts.push({ model, ok: false, ms, error: message.slice(0, 200) });
        console.warn("[ai/debug] model failed", { reqId, model, ms, error: message.slice(0, 200) });
        lastError = err;

        // Auth/rate errors won't be fixed by another model — bail fast.
        if (/401|403|invalid api key|unauthor/i.test(message)) {
          throw new Error("OpenRouter rejected the key. Check it via 'Your key' and try again.");
        }
        if (/429|rate limit/i.test(message)) {
          throw new Error("OpenRouter rate limit reached. Try again shortly or use a different key.");
        }
        // Otherwise (incl. no-endpoints, 5xx) continue to the next fallback.
        if (!isNoEndpointsError(message) && !/5\d\d/.test(message)) {
          // Unknown error — still try the next model once, but remember it.
        }
      }
    }

    console.error("[ai/debug] all models failed", { reqId, attempts });
    const tried = attempts.map((a) => a.model).join(", ");
    const detail = lastError instanceof Error ? lastError.message : String(lastError ?? "unknown");
    throw new Error(
      `OpenRouter has no working free model right now (tried: ${tried}). ` +
        `Try again in a moment, or add your own key via 'Your key'. Last error: ${detail}`,
    );
  });

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createClient } from "@supabase/supabase-js";
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

export type AttemptInfo = {
  model: string;
  ok: boolean;
  ms: number;
  status?: number;
  providers?: string[];
  error?: string;
};

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

// Returns available providers from OpenRouter's `/models/{id}/endpoints`.
async function probeEndpoints(
  model: string,
  key: string,
): Promise<{ available: boolean; providers: string[]; status: number }> {
  try {
    const res = await fetch(
      `https://openrouter.ai/api/v1/models/${encodeURIComponent(model)}/endpoints`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) return { available: false, providers: [], status: res.status };
    const body = (await res.json()) as {
      data?: { endpoints?: Array<{ provider_name?: string; name?: string }> };
    };
    const eps = body?.data?.endpoints ?? [];
    const providers = eps
      .map((e) => e.provider_name || e.name || "")
      .filter(Boolean);
    return { available: eps.length > 0, providers, status: res.status };
  } catch {
    return { available: true, providers: [], status: 0 };
  }
}

async function recordEvent(row: {
  run_id: string;
  language: string;
  executor: string;
  exit_code: number | null;
  key_source: string;
  success: boolean;
  final_model: string | null;
  attempts: AttemptInfo[];
  error: string | null;
  code_bytes: number;
  stderr_bytes: number;
  reply_bytes: number;
}) {
  try {
    const authHeader = getRequestHeader("authorization");
    if (!authHeader?.startsWith("Bearer ")) return;
    const token = authHeader.slice(7);
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return;
    const sb = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data: claims } = await sb.auth.getClaims(token);
    const userId = claims?.claims?.sub;
    if (!userId) return;
    await sb.from("ai_debug_events").insert({ user_id: userId, ...row });
  } catch (e) {
    console.warn("[ai/debug] recordEvent failed", { runId: row.run_id, error: String(e).slice(0, 160) });
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
    const runId = `ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const keySource = userKey ? "user-byo" : "env";

    if (!key) {
      return {
        ok: false as const,
        runId,
        message: "AI is not configured. Click 'Your key' to add your OpenRouter API key and try again.",
        attempts: [] as AttemptInfo[],
      };
    }

    const provider = buildProvider(key);
    const attempts: AttemptInfo[] = [];

    console.log("[ai/debug] request", {
      runId,
      language: data.language,
      codeBytes: data.code.length,
      stderrBytes: data.stderr.length,
      exitCode: data.exitCode,
      executor: data.provider,
      keySource,
      key: redactKey(key),
    });

    let lastError: unknown = null;

    for (const model of FALLBACK_MODELS) {
      const t0 = Date.now();
      const probe = await probeEndpoints(model, key);
      if (!probe.available) {
        const ms = Date.now() - t0;
        const a: AttemptInfo = {
          model, ok: false, ms,
          status: probe.status,
          providers: probe.providers,
          error: "no endpoints",
        };
        attempts.push(a);
        console.warn("[ai/debug] skip model (no endpoints)", { runId, model, ms, status: probe.status });
        continue;
      }

      try {
        const { text } = await generateText({ model: provider(model), messages });
        const ms = Date.now() - t0;
        attempts.push({ model, ok: true, ms, status: 200, providers: probe.providers });
        console.log("[ai/debug] success", { runId, model, ms, replyBytes: text.length, providers: probe.providers });
        await recordEvent({
          run_id: runId,
          language: data.language,
          executor: data.provider || "",
          exit_code: data.exitCode,
          key_source: keySource,
          success: true,
          final_model: model,
          attempts,
          error: null,
          code_bytes: data.code.length,
          stderr_bytes: data.stderr.length,
          reply_bytes: text.length,
        });
        return {
          ok: true as const,
          reply: text,
          source: userKey ? ("openrouter-user" as const) : ("openrouter-env" as const),
          model,
          runId,
          attempts,
        };
      } catch (err) {
        const ms = Date.now() - t0;
        const message = err instanceof Error ? err.message : String(err);
        attempts.push({
          model, ok: false, ms,
          providers: probe.providers,
          error: message.slice(0, 200),
        });
        console.warn("[ai/debug] model failed", { runId, model, ms, error: message.slice(0, 200) });
        lastError = err;

        if (/401|403|invalid api key|unauthor/i.test(message)) {
          await recordEvent({
            run_id: runId, language: data.language, executor: data.provider || "",
            exit_code: data.exitCode, key_source: keySource, success: false,
            final_model: null, attempts, error: "auth rejected",
            code_bytes: data.code.length, stderr_bytes: data.stderr.length, reply_bytes: 0,
          });
          return {
            ok: false as const, runId, attempts,
            message: "OpenRouter rejected the key. Check it via 'Your key' and try again.",
          };
        }
        if (/429|rate limit/i.test(message)) {
          await recordEvent({
            run_id: runId, language: data.language, executor: data.provider || "",
            exit_code: data.exitCode, key_source: keySource, success: false,
            final_model: null, attempts, error: "rate limited",
            code_bytes: data.code.length, stderr_bytes: data.stderr.length, reply_bytes: 0,
          });
          return {
            ok: false as const, runId, attempts,
            message: "OpenRouter rate limit reached. Try again shortly or use a different key.",
          };
        }
        if (!isNoEndpointsError(message) && !/5\d\d/.test(message)) {
          // Unknown error — still try the next model.
        }
      }
    }

    console.error("[ai/debug] all models failed", { runId, attempts });
    const tried = attempts.map((a) => a.model).join(", ");
    const detail = lastError instanceof Error ? lastError.message : String(lastError ?? "unknown");
    await recordEvent({
      run_id: runId, language: data.language, executor: data.provider || "",
      exit_code: data.exitCode, key_source: keySource, success: false,
      final_model: null, attempts, error: detail.slice(0, 500),
      code_bytes: data.code.length, stderr_bytes: data.stderr.length, reply_bytes: 0,
    });
    return {
      ok: false as const,
      runId,
      attempts,
      message: `OpenRouter has no working free model right now (tried: ${tried}). Try again in a moment, or add your own key via 'Your key'. Last error: ${detail}`,
    };
  });


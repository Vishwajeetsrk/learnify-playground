import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

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
  aiProvider: z.enum(["auto", "lovable", "openrouter"]).optional().default("auto"),
});

export type AiProviderChoice = "auto" | "lovable" | "openrouter";

// Lovable AI Gateway models (preferred — no user key needed, billed to workspace credits).
const LOVABLE_MODELS = [
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
] as const;

// OpenRouter models used when the user/project provides a key. Free models are tried first,
// then low-cost paid models so a funded key does not dead-end on unavailable free endpoints.
const OPENROUTER_FREE_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-chat-v3.1:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
] as const;

const OPENROUTER_PAID_MODELS = [
  "google/gemini-2.5-flash-lite",
  "openai/gpt-4o-mini",
  "mistralai/mistral-small-3.2-24b-instruct",
] as const;

const OPENROUTER_MODELS = [...OPENROUTER_FREE_MODELS, ...OPENROUTER_PAID_MODELS] as const;

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
      `https://openrouter.ai/api/v1/models/${model.split("/").map(encodeURIComponent).join("/")}/endpoints`,
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
    const lovableKey = process.env.LOVABLE_API_KEY?.trim();
    const envOpenRouterKey = process.env.OPENROUTER_API_KEY?.trim();
    const runId = `ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    // Routing: explicit choice via aiProvider, else auto (OpenRouter when a key exists, otherwise Lovable AI).
    const choice = data.aiProvider ?? "auto";
    let useOpenRouter: boolean;
    if (choice === "openrouter") useOpenRouter = true;
    else if (choice === "lovable") useOpenRouter = false;
    else useOpenRouter = !!(userKey || envOpenRouterKey);

    const keySource = useOpenRouter
      ? (userKey ? "user-byo" : envOpenRouterKey ? "env-openrouter" : "none")
      : (lovableKey ? "lovable-gateway" : "none");

    if (useOpenRouter && !userKey && !envOpenRouterKey) {
      return {
        ok: false as const,
        runId,
        message: "OpenRouter selected but no key is set. Add your key via 'Your key' or switch the provider to Lovable Gateway.",
        attempts: [] as AttemptInfo[],
      };
    }
    if (!useOpenRouter && !lovableKey) {
      return {
        ok: false as const,
        runId,
        message: "Lovable AI Gateway is not configured. Switch the provider to OpenRouter and add your key via 'Your key'.",
        attempts: [] as AttemptInfo[],
      };
    }

    const attempts: AttemptInfo[] = [];
    let lastError: unknown = null;

    console.log("[ai/debug] request", {
      runId,
      language: data.language,
      codeBytes: data.code.length,
      stderrBytes: data.stderr.length,
      exitCode: data.exitCode,
      executor: data.provider,
      keySource,
      route: useOpenRouter ? "openrouter" : "lovable",
    });

    // ----- Lovable AI Gateway path (default) -----
    if (!useOpenRouter && lovableKey) {
      const provider = createLovableAiGatewayProvider(lovableKey);
      for (const model of LOVABLE_MODELS) {
        const t0 = Date.now();
        try {
          const { text } = await generateText({ model: provider(model), messages });
          const ms = Date.now() - t0;
          attempts.push({ model, ok: true, ms, status: 200, providers: ["lovable"] });
          console.log("[ai/debug] success", { runId, model, ms, replyBytes: text.length });
          await recordEvent({
            run_id: runId, language: data.language, executor: data.provider || "",
            exit_code: data.exitCode, key_source: keySource, success: true,
            final_model: model, attempts, error: null,
            code_bytes: data.code.length, stderr_bytes: data.stderr.length, reply_bytes: text.length,
          });
          return {
            ok: true as const, reply: text,
            source: "lovable-gateway" as const,
            model, runId, attempts,
          };
        } catch (err) {
          const ms = Date.now() - t0;
          const message = err instanceof Error ? err.message : String(err);
          attempts.push({ model, ok: false, ms, providers: ["lovable"], error: message.slice(0, 200) });
          console.warn("[ai/debug] lovable model failed", { runId, model, ms, error: message.slice(0, 200) });
          lastError = err;

          if (/402|payment required|credits?|insufficient/i.test(message)) {
            await recordEvent({
              run_id: runId, language: data.language, executor: data.provider || "",
              exit_code: data.exitCode, key_source: keySource, success: false,
              final_model: null, attempts, error: "credits exhausted",
              code_bytes: data.code.length, stderr_bytes: data.stderr.length, reply_bytes: 0,
            });
            return {
              ok: false as const, runId, attempts,
              message: "Lovable AI credits are exhausted for this workspace. Top up credits in Settings → Plans & credits, or add your own OpenRouter key via 'Your key'.",
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
              message: "Lovable AI rate limit reached. Try again shortly.",
            };
          }
        }
      }

      const detail = lastError instanceof Error ? lastError.message : String(lastError ?? "unknown");
      console.error("[ai/debug] all lovable models failed", { runId, attempts });
      await recordEvent({
        run_id: runId, language: data.language, executor: data.provider || "",
        exit_code: data.exitCode, key_source: keySource, success: false,
        final_model: null, attempts, error: detail.slice(0, 500),
        code_bytes: data.code.length, stderr_bytes: data.stderr.length, reply_bytes: 0,
      });
      return {
        ok: false as const, runId, attempts,
        message: `Lovable AI couldn't complete the request (tried ${attempts.map(a => a.model).join(", ")}). Last error: ${detail}`,
      };
    }

    // ----- OpenRouter path (user supplied a BYO key or project key) -----
    const orKey = (userKey || envOpenRouterKey)!;
    const provider = buildProvider(orKey);
    console.log("[ai/debug] openrouter key", { runId, key: redactKey(orKey) });

    for (const model of OPENROUTER_MODELS) {
      const t0 = Date.now();
      const probe = await probeEndpoints(model, orKey);
      if (!probe.available) {
        const ms = Date.now() - t0;
        attempts.push({ model, ok: false, ms, status: probe.status, providers: probe.providers, error: "no endpoints" });
        console.warn("[ai/debug] skip model (no endpoints)", { runId, model, ms, status: probe.status });
        continue;
      }

      try {
        const { text } = await generateText({ model: provider(model), messages });
        const ms = Date.now() - t0;
        attempts.push({ model, ok: true, ms, status: 200, providers: probe.providers });
        console.log("[ai/debug] success", { runId, model, ms, replyBytes: text.length, providers: probe.providers });
        await recordEvent({
          run_id: runId, language: data.language, executor: data.provider || "",
          exit_code: data.exitCode, key_source: keySource, success: true,
          final_model: model, attempts, error: null,
          code_bytes: data.code.length, stderr_bytes: data.stderr.length, reply_bytes: text.length,
        });
        return {
          ok: true as const, reply: text,
          source: userKey ? ("openrouter-user" as const) : ("openrouter-env" as const),
          model, runId, attempts,
        };
      } catch (err) {
        const ms = Date.now() - t0;
        const message = err instanceof Error ? err.message : String(err);
        attempts.push({ model, ok: false, ms, providers: probe.providers, error: message.slice(0, 200) });
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
      }
    }

    console.error("[ai/debug] all openrouter models failed", { runId, attempts });
    const tried = attempts.map((a) => a.model).join(", ");
    const detail = lastError instanceof Error ? lastError.message : String(lastError ?? "unknown");

    if (lovableKey) {
      console.warn("[ai/debug] falling back to lovable gateway", { runId, failedRoute: "openrouter", tried });
      const fallbackProvider = createLovableAiGatewayProvider(lovableKey);
      for (const model of LOVABLE_MODELS) {
        const t0 = Date.now();
        try {
          const { text } = await generateText({ model: fallbackProvider(model), messages });
          const ms = Date.now() - t0;
          attempts.push({ model, ok: true, ms, status: 200, providers: ["lovable-fallback"] });
          console.log("[ai/debug] fallback success", { runId, model, ms, replyBytes: text.length });
          await recordEvent({
            run_id: runId, language: data.language, executor: data.provider || "",
            exit_code: data.exitCode, key_source: "lovable-gateway-fallback", success: true,
            final_model: model, attempts, error: null,
            code_bytes: data.code.length, stderr_bytes: data.stderr.length, reply_bytes: text.length,
          });
          return {
            ok: true as const, reply: text,
            source: "lovable-gateway-fallback" as const,
            model, runId, attempts,
          };
        } catch (err) {
          const ms = Date.now() - t0;
          const message = err instanceof Error ? err.message : String(err);
          attempts.push({ model, ok: false, ms, providers: ["lovable-fallback"], error: message.slice(0, 200) });
          console.warn("[ai/debug] fallback model failed", { runId, model, ms, error: message.slice(0, 200) });
          lastError = err;

          if (/402|payment required|credits?|insufficient/i.test(message)) break;
        }
      }
    }

    console.error("[ai/debug] all models failed", { runId, attempts });
    const finalDetail = lastError instanceof Error ? lastError.message : String(lastError ?? detail);
    await recordEvent({
      run_id: runId, language: data.language, executor: data.provider || "",
      exit_code: data.exitCode, key_source: keySource, success: false,
      final_model: null, attempts, error: finalDetail.slice(0, 500),
      code_bytes: data.code.length, stderr_bytes: data.stderr.length, reply_bytes: 0,
    });
    return {
      ok: false as const,
      runId,
      attempts,
      message: `All configured AI routes failed. OpenRouter tried free and low-cost models (${tried}); Lovable AI fallback also failed. Add credits to either provider or retry later. Last error: ${finalDetail}`,
    };
  });


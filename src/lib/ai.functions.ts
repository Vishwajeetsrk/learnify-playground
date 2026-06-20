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

function buildOpenRouterModel(userKey: string) {
  const provider = createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    headers: {
      Authorization: `Bearer ${userKey}`,
      "HTTP-Referer": "https://polyglot-orbit.app",
      "X-Title": "Polyglot Orbit Playground",
    },
  });
  // Free, capable default on OpenRouter
  return provider("google/gemini-2.0-flash-exp:free");
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

    // Resolve OpenRouter key: user-supplied (browser) takes priority,
    // otherwise fall back to the server-side OPENROUTER_API_KEY secret.
    const userKey = data.userApiKey?.trim();
    const envKey = process.env.OPENROUTER_API_KEY?.trim();
    const key = userKey || envKey;

    if (!key) {
      throw new Error(
        "AI is not configured. Click 'Your key' to add your OpenRouter API key and try again.",
      );
    }

    try {
      const { text } = await generateText({ model: buildOpenRouterModel(key), messages });
      return { reply: text, source: userKey ? ("openrouter-user" as const) : ("openrouter-env" as const) };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("429"))
        throw new Error("OpenRouter rate limit reached. Try again shortly or use a different key.");
      if (message.includes("401") || message.includes("403"))
        throw new Error("OpenRouter rejected the key. Check it via 'Your key' and try again.");
      throw new Error(`OpenRouter error: ${message}`);
    }
  });


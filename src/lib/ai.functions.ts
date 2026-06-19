import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const DebugInput = z.object({
  language: z.string().min(1).max(50),
  code: z.string().min(1).max(20000),
  stdout: z.string().max(20000).optional().default(""),
  stderr: z.string().max(20000).optional().default(""),
  exitCode: z.number().nullable().optional().default(null),
  provider: z.string().max(50).optional().default(""),
  stdin: z.string().max(10000).optional().default(""),
  question: z.string().max(2000).optional().default(""),
});

export const debugCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => DebugInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

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

    try {
      const { text } = await generateText({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      return { reply: text };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("429")) throw new Error("AI rate limit reached. Try again in a moment.");
      if (message.includes("402")) throw new Error("AI credits exhausted for this workspace.");
      throw new Error(`AI error: ${message}`);
    }
  });

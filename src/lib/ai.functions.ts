import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const DebugInput = z.object({
  language: z.string().min(1).max(50),
  code: z.string().min(1).max(20000),
  output: z.string().max(20000).optional().default(""),
  question: z.string().max(2000).optional().default(""),
});

export const debugCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => DebugInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const system = `You are a concise senior engineer helping a developer debug code in the Playground.
- Identify root causes in the provided code or runtime output.
- Suggest minimal, copy-pasteable fixes with short code snippets in fenced blocks.
- If the code already runs cleanly, suggest one improvement.
- Keep responses under 250 words. Use markdown.`;

    const user = `Language: ${data.language}

CODE:
\`\`\`${data.language}
${data.code}
\`\`\`

PROGRAM OUTPUT / ERROR:
\`\`\`
${data.output || "(no output captured)"}
\`\`\`

${data.question ? `QUESTION FROM USER: ${data.question}` : "Explain any issue and suggest a fix."}`;

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

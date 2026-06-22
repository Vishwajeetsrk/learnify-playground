import { useMemo, useState } from "react";
import { Check, Loader2, Sparkles, Wand2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { debugCode } from "@/lib/ai.functions";
import { useUserApiKey } from "@/lib/user-api-key";
import { ByoKeyButton } from "@/components/byo-key-button";

interface Props {
  html: string;
  css: string;
  js: string;
  consoleErrors: string;
  onApply: (next: { html?: string; css?: string; js?: string }) => void;
}

function extractBlock(reply: string, tag: string): string | null {
  const re = new RegExp("```" + tag + "\\n([\\s\\S]*?)```", "i");
  const m = reply.match(re);
  return m ? m[1].trimEnd() : null;
}

export function WebAiDebugPanel({ html, css, js, consoleErrors, onApply }: Props) {
  const ask = useServerFn(debugCode);
  const { key: userApiKey } = useUserApiKey();
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);
  const [aiProvider, setAiProvider] = useState<"auto" | "lovable" | "openrouter">("auto");

  const fixes = useMemo(() => {
    if (!reply) return null;
    const h = extractBlock(reply, "html");
    const c = extractBlock(reply, "css");
    const j = extractBlock(reply, "js") ?? extractBlock(reply, "javascript");
    if (!h && !c && !j) return null;
    return { html: h ?? undefined, css: c ?? undefined, js: j ?? undefined };
  }, [reply]);

  async function run() {
    setLoading(true);
    setReply("");
    setApplied(false);
    try {
      const combined = `<!-- HTML -->\n${html}\n\n/* CSS */\n${css}\n\n// JS\n${js}`;
      const res = await ask({
        data: {
          language: "html",
          code: combined,
          stdout: "",
          stderr: consoleErrors,
          exitCode: consoleErrors ? 1 : 0,
          provider: "iframe",
          stdin: "",
          question:
            (question ? question + "\n\n" : "") +
            "Return fixed code in THREE separate fenced blocks tagged ```html, ```css, and ```js (only include the ones that need changes). Each block must be the complete file contents.",
          userApiKey,
          aiProvider,
      });
      if (res.ok) {
        setReply(res.reply);
      } else {
        toast.error(`[${res.runId}] ${res.message}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function apply() {
    if (!fixes) return;
    onApply(fixes);
    setApplied(true);
    toast.success("Fix applied");
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border/60 bg-card/30 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" /> AI debug helper
        <span className="ml-auto flex items-center gap-2 text-[10px] font-normal normal-case text-muted-foreground/70">
          <span>Sees HTML · CSS · JS · console errors</span>
          <ByoKeyButton />
        </span>
      </div>
      {consoleErrors && (
        <pre className="max-h-24 overflow-auto rounded border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">
          {consoleErrors}
        </pre>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about a bug, or leave blank to auto-diagnose…"
          className="h-9 w-full min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring sm:h-8"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) run();
          }}
        />
        <Button size="sm" onClick={run} disabled={loading} className="w-full sm:w-auto">
          {loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
          Ask AI
        </Button>
      </div>
      {reply && (
        <>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border/60 bg-background p-2 text-xs leading-relaxed">
            {reply}
          </pre>
          {fixes && (
            <div className="flex items-center justify-between rounded-md border border-primary/40 bg-primary/5 px-2 py-1.5">
              <span className="text-[11px] text-muted-foreground">
                Suggested fix: {[fixes.html && "HTML", fixes.css && "CSS", fixes.js && "JS"].filter(Boolean).join(" + ")}
              </span>
              <Button size="sm" variant="secondary" onClick={apply} disabled={applied}>
                {applied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Wand2 className="mr-1 h-3.5 w-3.5" />}
                {applied ? "Applied" : "Apply fix"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

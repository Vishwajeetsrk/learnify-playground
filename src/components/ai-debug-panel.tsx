import { useMemo, useState } from "react";
import { Check, Loader2, Sparkles, Wand2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { debugCode } from "@/lib/ai.functions";
import type { ProviderKey } from "@/lib/executors";

interface Props {
  language: string;
  code: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  provider: ProviderKey;
  stdin: string;
  onApplyFix: (next: string) => void;
}

function extractFix(reply: string, language: string): string | null {
  if (!reply) return null;
  // Match ``` followed by optional language tag
  const fence = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;
  let best: { lang: string; body: string } | null = null;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(reply)) !== null) {
    const tag = (m[1] || "").toLowerCase();
    const body = m[2];
    if (!body.trim()) continue;
    const candidate = { lang: tag, body };
    if (tag === language.toLowerCase() || tag === "tsx" && language === "typescript") {
      best = candidate;
      break;
    }
    if (!best) best = candidate;
  }
  return best?.body.trimEnd() ?? null;
}

export function AiDebugPanel({
  language,
  code,
  stdout,
  stderr,
  exitCode,
  provider,
  stdin,
  onApplyFix,
}: Props) {
  const ask = useServerFn(debugCode);
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);

  const fix = useMemo(() => extractFix(reply, language), [reply, language]);

  async function run() {
    if (!code.trim()) {
      toast.error("Write some code first");
      return;
    }
    setLoading(true);
    setReply("");
    setApplied(false);
    try {
      const res = await ask({
        data: {
          language,
          code,
          stdout,
          stderr,
          exitCode,
          provider,
          stdin,
          question,
        },
      });
      setReply(res.reply);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function apply() {
    if (!fix) return;
    onApplyFix(fix);
    setApplied(true);
    toast.success("Fix applied to editor");
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border/60 bg-card/30 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" /> AI debug helper
        <span className="ml-auto text-[10px] font-normal normal-case text-muted-foreground/70">
          Sees code · stdin · stdout · stderr · exit · provider
        </span>
      </div>
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about an error, or leave blank to auto-diagnose…"
          className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) run();
          }}
        />
        <Button size="sm" onClick={run} disabled={loading}>
          {loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
          Ask AI
        </Button>
      </div>
      {reply && (
        <>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border/60 bg-background p-2 text-xs leading-relaxed">
            {reply}
          </pre>
          {fix && (
            <div className="flex items-center justify-between rounded-md border border-primary/40 bg-primary/5 px-2 py-1.5">
              <span className="text-[11px] text-muted-foreground">
                Suggested {language} fix detected ({fix.split("\n").length} lines)
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

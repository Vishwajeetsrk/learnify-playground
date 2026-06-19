import { useMemo, useState } from "react";
import { Check, Loader2, Sparkles, Wand2, BookOpen, Wrench, Zap, RefreshCcw, FileText, FlaskConical, Pencil } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { debugCode } from "@/lib/ai.functions";
import type { ProviderKey } from "@/lib/executors";

type ActionKey = "diagnose" | "explain" | "fix" | "optimize" | "convert" | "tests" | "docs" | "generate";

const ACTIONS: { key: ActionKey; label: string; Icon: typeof Sparkles; prompt: (lang: string, q: string) => string }[] = [
  { key: "diagnose", label: "Diagnose",   Icon: Sparkles,     prompt: (_l, q) => q || "Diagnose any issue and return the full fixed program." },
  { key: "explain",  label: "Explain",    Icon: BookOpen,     prompt: (_l) => "Explain what this code does step by step in plain language. Then re-output the same code unchanged so the editor stays intact." },
  { key: "fix",      label: "Fix errors", Icon: Wrench,       prompt: () => "Find and fix any bugs or runtime errors. Return the corrected full program." },
  { key: "optimize", label: "Optimize",   Icon: Zap,          prompt: () => "Refactor for readability and performance. Keep behaviour identical. Return the optimized full program." },
  { key: "convert",  label: "Convert",    Icon: RefreshCcw,   prompt: (_l, q) => `Convert this program to ${q || "TypeScript"}. Return the converted full program in a fenced code block tagged with the target language.` },
  { key: "tests",    label: "Tests",      Icon: FlaskConical, prompt: (l) => `Write unit tests for this ${l} program using the language's standard test conventions. Return the test file as a fenced code block.` },
  { key: "docs",     label: "Docs",       Icon: FileText,     prompt: () => "Add concise docstrings/comments to every public function or type. Return the documented full program." },
  { key: "generate", label: "Generate",   Icon: Pencil,       prompt: (l, q) => `Generate ${l} code that does the following: ${q || "describe what you want in the input box."} Return only the program in a fenced code block.` },
];

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

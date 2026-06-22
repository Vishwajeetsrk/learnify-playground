import { useMemo, useState } from "react";
import { AlertTriangle, Check, ClipboardCopy, Loader2, RefreshCcw as Retry, Sparkles, Wand2, BookOpen, Wrench, Zap, RefreshCcw, FileText, FlaskConical, Pencil, Play } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { debugCode } from "@/lib/ai.functions";
import type { AttemptInfo } from "@/lib/ai.functions";
import { useUserApiKey } from "@/lib/user-api-key";
import { ByoKeyButton } from "@/components/byo-key-button";
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
  const fence = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;
  let best: { lang: string; body: string } | null = null;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(reply)) !== null) {
    const tag = (m[1] || "").toLowerCase();
    const body = m[2];
    if (!body.trim()) continue;
    const candidate = { lang: tag, body };
    if (tag === language.toLowerCase() || (tag === "tsx" && language === "typescript")) {
      best = candidate;
      break;
    }
    if (!best) best = candidate;
  }
  return best?.body.trimEnd() ?? null;
}

type LastRequest = {
  language: string;
  code: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  provider: ProviderKey;
  stdin: string;
  question: string;
  userApiKey: string;
  aiProvider: "auto" | "lovable" | "openrouter";
};

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
  const { key: userApiKey } = useUserApiKey();
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);
  const [action, setAction] = useState<ActionKey>("diagnose");
  const [aiProvider, setAiProvider] = useState<"auto" | "lovable" | "openrouter">("auto");
  const [runId, setRunId] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<AttemptInfo[]>([]);
  const [finalModel, setFinalModel] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<LastRequest | null>(null);

  const fix = useMemo(() => extractFix(reply, language), [reply, language]);
  const currentAction = ACTIONS.find((a) => a.key === action)!;

  async function send(payload: LastRequest) {
    setLoading(true);
    setReply("");
    setErrorMsg(null);
    setApplied(false);
    setAttempts([]);
    setFinalModel(null);
    setLastRequest(payload);
    try {
      const res = await ask({ data: payload });
      setRunId(res.runId);
      setAttempts(res.attempts);
      if (res.ok) {
        setReply(res.reply);
        setFinalModel(res.model);
      } else {
        setErrorMsg(res.message);
        toast.error(`[${res.runId}] ${res.message}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function run(actionKey: ActionKey = action) {
    if (!code.trim() && actionKey !== "generate") {
      toast.error("Write some code first");
      return;
    }
    const act = ACTIONS.find((a) => a.key === actionKey)!;
    setAction(actionKey);
    await send({
      language, code: code || "(empty)", stdout, stderr, exitCode, provider, stdin,
      question: act.prompt(language, question.trim()),
      userApiKey,
      aiProvider,
    });
  }

  function replay() {
    if (!lastRequest) return;
    void send(lastRequest);
  }

  function copyDebug() {
    const blob = {
      runId,
      ok: !errorMsg,
      language,
      executor: provider,
      exitCode,
      keySource: userApiKey ? "user-byo" : "env",
      finalModel,
      attempts,
      error: errorMsg,
      sizes: {
        code: code.length, stderr: stderr.length, stdout: stdout.length,
        reply: reply.length,
      },
      timestamp: new Date().toISOString(),
    };
    void navigator.clipboard.writeText(JSON.stringify(blob, null, 2))
      .then(() => toast.success("Debug info copied"))
      .catch(() => toast.error("Copy failed"));
  }

  function apply() {
    if (!fix) return;
    onApplyFix(fix);
    setApplied(true);
    toast.success("Applied to editor");
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border/60 bg-card/30 p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate">AI assistant</span>
          {runId && (
            <span className="hidden truncate rounded-md border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] font-normal normal-case tracking-normal text-muted-foreground sm:inline-block">
              {runId}
            </span>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <ByoKeyButton />
          <span className="rounded-md border border-border/60 bg-muted px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-foreground">
            {language}
          </span>
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {ACTIONS.map((a) => {
          const Icon = a.Icon;
          const active = a.key === action;
          return (
            <button key={a.key} onClick={() => setAction(a.key)}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition ${
                active
                  ? "border-primary/60 bg-primary/15 text-foreground"
                  : "border-border bg-background text-foreground/80 hover:bg-muted hover:text-foreground"
              }`}>
              <Icon className="h-3 w-3" /> {a.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={
            action === "convert" ? "Target language (e.g. Rust, TypeScript)…"
            : action === "generate" ? "Describe what you want to build…"
            : "Optional details (or leave blank)…"
          }
          className="h-9 w-full min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground sm:h-8"
          onKeyDown={(e) => { if (e.key === "Enter" && !loading) run(); }}
        />
        <Button size="sm" onClick={() => run()} disabled={loading} className="w-full sm:w-auto">
          {loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <currentAction.Icon className="mr-1 h-3.5 w-3.5" />}
          {currentAction.label}
        </Button>
      </div>

      {errorMsg && !loading && (
        <div className="flex flex-col gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-foreground">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-destructive">AI request failed</span>
                {runId && (
                  <span className="rounded border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {runId}
                  </span>
                )}
              </div>
              <div className="mt-1 break-words text-foreground/80">{errorMsg}</div>
            </div>
          </div>

          {attempts.length > 0 && (
            <div className="overflow-x-auto rounded border border-border/50 bg-background/50">
              <table className="w-full min-w-[480px] text-left text-[11px]">
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border/40">
                    <th className="px-2 py-1 font-medium">Model</th>
                    <th className="px-2 py-1 font-medium">Status</th>
                    <th className="px-2 py-1 font-medium">Providers</th>
                    <th className="px-2 py-1 text-right font-medium">ms</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a, i) => (
                    <tr key={i} className="border-b border-border/30 last:border-0">
                      <td className="truncate px-2 py-1 font-mono">{a.model}</td>
                      <td className="px-2 py-1">
                        <span className={a.ok ? "text-emerald-500" : "text-destructive"}>
                          {a.ok ? "ok" : a.error || "failed"}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-foreground/80">
                        {a.providers && a.providers.length > 0 ? a.providers.join(", ") : "—"}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">{a.ms}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="h-7" onClick={() => run()}>
              <Retry className="mr-1 h-3 w-3" /> Retry
            </Button>
            <Button size="sm" variant="outline" className="h-7" onClick={replay} disabled={!lastRequest}>
              <Play className="mr-1 h-3 w-3" /> Replay last
            </Button>
            <Button size="sm" variant="outline" className="h-7" onClick={copyDebug}>
              <ClipboardCopy className="mr-1 h-3 w-3" /> Copy debug info
            </Button>
          </div>
        </div>
      )}

      {reply && (
        <>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border/60 bg-background p-2 text-xs leading-relaxed text-foreground">
            {reply}
          </pre>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 px-2 py-1.5">
            <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
              {fix
                ? `Suggested ${language} fix detected (${fix.split("\n").length} lines)`
                : `Replied via ${finalModel ?? "model"}`}
              {runId && <span className="ml-2 font-mono text-[10px]">{runId}</span>}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" className="h-7" onClick={copyDebug}>
                <ClipboardCopy className="mr-1 h-3 w-3" /> Copy debug
              </Button>
              {fix && (
                <Button size="sm" variant="secondary" onClick={apply} disabled={applied}>
                  {applied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Wand2 className="mr-1 h-3.5 w-3.5" />}
                  {applied ? "Applied" : "Apply fix"}
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

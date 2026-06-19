import { createFileRoute } from "@tanstack/react-router";
import Editor from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import { Copy, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGES, PROVIDERS, runCode, type LangKey, type ProviderKey } from "@/lib/executors";
import { QuotaIndicator } from "@/components/quota-indicator";
import { AiDebugPanel } from "@/components/ai-debug-panel";

export const Route = createFileRoute("/playground/")({
  head: () => ({ meta: [{ title: "Code Playground" }] }),
  component: CodePlayground,
});

function CodePlayground() {
  const [lang, setLang] = useState<LangKey>("python");
  const [provider, setProvider] = useState<ProviderKey>("wandbox");
  const [code, setCode] = useState(LANGUAGES.python.starter);
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState("");
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [activeProvider, setActiveProvider] = useState<ProviderKey>("wandbox");
  const [fallbackInfo, setFallbackInfo] = useState<{ from: ProviderKey; to: ProviderKey; reason: string } | null>(null);
  const [running, setRunning] = useState(false);
  const dirtyRef = useRef(false);

  useEffect(() => {
    setActiveProvider(provider);
    setFallbackInfo(null);
  }, [provider]);

  function setLanguage(next: LangKey) {
    if (!dirtyRef.current || code === LANGUAGES[lang].starter) {
      setCode(LANGUAGES[next].starter);
    }
    setLang(next);
  }

  async function handleRun() {
    setRunning(true);
    setOutput("Running…");
    setStdout("");
    setStderr("");
    setExitCode(null);
    setFallbackInfo(null);
    try {
      const r = await runCode(lang, code, stdin, provider, {
        fallback: true,
        onFallback: (info) => {
          toast.warning(`${PROVIDERS[info.from].label} unavailable — falling back to ${PROVIDERS[info.to].label}`, {
            description: info.reason,
          });
          setActiveProvider(info.to);
          setFallbackInfo(info);
        },
      });
      setActiveProvider(r.provider);
      setOutput(r.output || "(no output)");
      setStdout(r.stdout);
      setStderr(r.stderr);
      setExitCode(r.code);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setOutput(`Error: ${msg}`);
      setStderr(msg);
      toast.error("Run failed", { description: msg });
    } finally {
      setRunning(false);
    }
  }


  async function handleCopy() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    toast.success("Output copied");
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col lg:h-[calc(100vh-3.5rem)]">
      <h1 className="sr-only">Code Playground</h1>
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-card/40 p-2">
        <Select value={lang} onValueChange={(v) => setLanguage(v as LangKey)}>
          <SelectTrigger className="h-9 w-32 sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(LANGUAGES) as LangKey[]).map((k) => (
              <SelectItem key={k} value={k}>
                {LANGUAGES[k].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={provider} onValueChange={(v) => setProvider(v as ProviderKey)}>
          <SelectTrigger className="h-9 w-32 sm:w-40" title="Code execution provider">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PROVIDERS) as ProviderKey[]).map((k) => (
              <SelectItem key={k} value={k}>
                {PROVIDERS[k].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <QuotaIndicator provider={provider} />
        <div className="ml-auto flex flex-wrap gap-2">
          <Button onClick={handleRun} disabled={running} size="sm">
            {running ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}
            Run
          </Button>
          <Button onClick={handleCopy} disabled={!output} size="sm" variant="outline">
            <Copy className="mr-1 h-4 w-4" /> Copy
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="h-[50vh] shrink-0 border-b border-border/60 lg:h-auto lg:flex-1 lg:border-b-0 lg:border-r">
          <Editor
            height="100%"
            language={LANGUAGES[lang].monaco}
            value={code}
            theme="vs-dark"
            onChange={(v) => {
              dirtyRef.current = true;
              setCode(v ?? "");
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
            }}
          />
        </div>

        <div className="flex w-full min-w-0 flex-col lg:w-[40%]">
          <div className="border-b border-border/60 bg-card/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            stdin
          </div>
          <textarea
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder="Optional input passed to your program…"
            className="h-20 shrink-0 resize-none bg-background p-3 font-mono text-xs outline-none"
          />
          <div className="flex items-center justify-between border-y border-border/60 bg-card/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Terminal</span>
            {(stdout || stderr || exitCode !== null) && (
              <span className="font-mono text-[10px] normal-case tracking-normal text-muted-foreground/80">
                {activeProvider} · exit {exitCode ?? "?"}
              </span>
            )}
          </div>
          <pre className="min-h-[180px] flex-1 overflow-auto whitespace-pre-wrap break-words bg-black p-3 font-mono text-xs leading-relaxed text-green-300">
            {output || "Run your code to see output here."}
          </pre>
          <AiDebugPanel
            language={lang}
            code={code}
            stdout={stdout}
            stderr={stderr}
            exitCode={exitCode}
            provider={activeProvider}
            stdin={stdin}
            onApplyFix={(next) => {
              dirtyRef.current = true;
              setCode(next);
            }}
          />
        </div>
      </div>
    </div>
  );
}

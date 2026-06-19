import { createFileRoute, useNavigate } from "@tanstack/react-router";
import Editor from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import { Copy, Loader2, Play, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { LANGUAGES, PROVIDERS, runCode, type LangKey, type ProviderKey } from "@/lib/executors";
import { ProjectSidebar, type PlaygroundProject } from "@/components/project-sidebar";
import { QuotaIndicator } from "@/components/quota-indicator";
import { AiDebugPanel } from "@/components/ai-debug-panel";

export const Route = createFileRoute("/playground/")({
  head: () => ({ meta: [{ title: "Code Playground" }] }),
  component: CodePlayground,
});

function CodePlayground() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [lang, setLang] = useState<LangKey>("python");
  const [provider, setProvider] = useState<ProviderKey>("piston");
  const [code, setCode] = useState(LANGUAGES.python.starter);
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState("");
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [activeProvider, setActiveProvider] = useState<ProviderKey>("piston");
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("Untitled");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const dirtyRef = useRef(false);


  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { redirect: "/playground" } });
  }, [user, loading, navigate]);

  useEffect(() => {
    setActiveProvider(provider);
  }, [provider]);


  function setLanguage(next: LangKey) {
    if (!dirtyRef.current || code === LANGUAGES[lang].starter) {
      setCode(LANGUAGES[next].starter);
    }
    setLang(next);
  }

  function newProject() {
    setProjectId(null);
    setName("Untitled");
    setCode(LANGUAGES[lang].starter);
    setOutput("");
    dirtyRef.current = false;
  }

  function openProject(p: PlaygroundProject) {
    setProjectId(p.id);
    setName(p.name);
    if (p.language && p.language in LANGUAGES) setLang(p.language as LangKey);
    setCode(p.code ?? "");
    setOutput("");
    dirtyRef.current = false;
  }

  async function handleRun() {
    setRunning(true);
    setOutput("Running…");
    setStdout("");
    setStderr("");
    setExitCode(null);
    try {
      const r = await runCode(lang, code, stdin, provider, {
        fallback: true,
        onFallback: ({ from, to, reason }) => {
          toast.warning(`${PROVIDERS[from].label} unavailable — falling back to ${PROVIDERS[to].label}`, {
            description: reason,
          });
          setActiveProvider(to);
        },
      });
      setActiveProvider(r.provider);
      setOutput(r.output || "(no output)");
      setStdout(r.stdout);
      setStderr(r.stderr);
      setExitCode(r.code);
      if (user) {
        await supabase.from("playground_runs").insert({
          user_id: user.id,
          project_id: projectId,
          language: lang,
          source: code,
          stdin,
          stdout: r.stdout,
          stderr: r.stderr,
          exit_code: r.code,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setOutput(`Error: ${msg}`);
      setStderr(msg);
      toast.error("Run failed", { description: msg });
    } finally {
      setRunning(false);
    }
  }


  async function handleSave() {
    if (!user) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      name: name.trim() || "Untitled",
      kind: "code" as const,
      language: lang,
      code,
    };
    if (projectId) {
      const { error } = await supabase
        .from("playground_projects")
        .update(payload)
        .eq("id", projectId);
      if (error) toast.error(error.message);
      else toast.success("Saved");
    } else {
      const { data, error } = await supabase
        .from("playground_projects")
        .insert(payload)
        .select("id")
        .single();
      if (error) toast.error(error.message);
      else {
        setProjectId(data.id);
        toast.success("Project saved");
      }
    }
    setSaving(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleCopy() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    toast.success("Output copied");
  }

  if (loading || !user) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col lg:flex-row">
      <div className="hidden lg:block">
        <ProjectSidebar
          kind="code"
          currentId={projectId}
          onOpen={openProject}
          onNew={newProject}
          refreshKey={refreshKey}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-card/40 p-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 w-40 sm:w-56"
            placeholder="Project name"
          />
          <Select value={lang} onValueChange={(v) => setLanguage(v as LangKey)}>
            <SelectTrigger className="h-9 w-36">
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
            <SelectTrigger className="h-9 w-40" title="Code execution provider">
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
            <Button onClick={handleSave} disabled={saving} size="sm" variant="secondary">
              <Save className="mr-1 h-4 w-4" /> Save
            </Button>
            <Button onClick={handleCopy} disabled={!output} size="sm" variant="outline">
              <Copy className="mr-1 h-4 w-4" /> Copy
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="min-h-[40vh] flex-1 border-b border-border/60 lg:border-b-0 lg:border-r">
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

          <div className="flex min-h-[35vh] w-full flex-col lg:w-[40%]">
            <div className="border-b border-border/60 bg-card/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              stdin
            </div>
            <textarea
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder="Optional input passed to your program…"
              className="min-h-[60px] resize-none bg-background p-3 font-mono text-xs outline-none"
            />
            <div className="flex items-center justify-between border-y border-border/60 bg-card/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Terminal</span>
              {(stdout || stderr || exitCode !== null) && (
                <span className="font-mono text-[10px] normal-case tracking-normal text-muted-foreground/80">
                  {activeProvider} · exit {exitCode ?? "?"}
                </span>
              )}
            </div>
            <pre className="flex-1 overflow-auto bg-black p-3 font-mono text-xs leading-relaxed text-green-300">
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

        <div className="border-t border-border/60 p-2 lg:hidden">
          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground">My projects</summary>
            <div className="mt-2 h-64">
              <ProjectSidebar
                kind="code"
                currentId={projectId}
                onOpen={openProject}
                onNew={newProject}
                refreshKey={refreshKey}
              />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

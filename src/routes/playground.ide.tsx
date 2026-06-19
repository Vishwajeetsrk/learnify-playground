import { createFileRoute } from "@tanstack/react-router";
import Editor, { type OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play, Save, Share2, Sparkles, Settings as SettingsIcon, Loader2, Copy,
  Plus, FilePlus2, Trash2, Smartphone, Tablet, Monitor, Maximize2, Minimize2,
  Eraser, FolderOpen, X, RefreshCw, Terminal, LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { LANGUAGES, PROVIDERS, runCode, type LangKey } from "@/lib/executors";
import { AiDebugPanel } from "@/components/ai-debug-panel";
import {
  APP_THEMES, EDITOR_THEMES, useAppTheme, useEditorTheme, registerEditorThemes,
  type AppThemeKey, type EditorThemeKey,
} from "@/lib/playground/themes";
import { TEMPLATES, WEB_TEMPLATES, type Template } from "@/lib/playground/templates";
import {
  buildPreviewDoc, parseConsoleMessage, PREVIEW_VIEWPORTS, type ViewportKey,
} from "@/lib/playground/web-bundle";

export const Route = createFileRoute("/playground/ide")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mobile IDE Playground · VS Code on your phone" },
      { name: "description", content: "Full mobile IDE: write, run, preview, and AI-debug HTML/CSS/JS, Python, Node, Java, and more from your phone." },
    ],
  }),
  component: () => <IdePlayground />,
});

export interface IdePlaygroundProps {
  defaultKind?: "web" | "code";
  storageKey?: string;
  defaultLanguage?: LangKey;
  defaultProjectName?: string;
}

// --------------------------------------------------------------------------
// Types

type Kind = "web" | "code";

interface IdeFile {
  id: string;
  name: string;          // display + filename (e.g. index.html)
  language: string;      // monaco language id
  content: string;
}

interface IdeState {
  kind: Kind;
  language: LangKey;     // for "code" projects
  projectName: string;
  files: IdeFile[];
  activeFileId: string;
}

interface ConsoleEntry { id: number; level: string; text: string }

const DEFAULT_LS_KEY = "playground-ide:v1";
const QUICK_KEYS = ["Tab", "{", "}", "(", ")", "[", "]", ";", "=", "<", ">", "\"", "/"] as const;

function uid(): string { return Math.random().toString(36).slice(2, 10); }

function blankWeb(): IdeState {
  const t = WEB_TEMPLATES.find((w) => w.id === "blank-web")!;
  return {
    kind: "web", language: "javascript", projectName: t.name,
    files: [
      { id: uid(), name: "index.html", language: "html", content: t.files.html },
      { id: uid(), name: "style.css",  language: "css",  content: t.files.css },
      { id: uid(), name: "script.js",  language: "javascript", content: t.files.js },
    ],
    activeFileId: "",
  };
}

function fromTemplate(t: Template): IdeState {
  if (t.kind === "web") {
    const files = [
      { id: uid(), name: "index.html", language: "html", content: t.files.html },
      { id: uid(), name: "style.css",  language: "css",  content: t.files.css },
      { id: uid(), name: "script.js",  language: "javascript", content: t.files.js },
    ];
    return { kind: "web", language: "javascript", projectName: t.name, files, activeFileId: files[0].id };
  }
  const ext = extForLang(t.language);
  const f: IdeFile = { id: uid(), name: `main.${ext}`, language: LANGUAGES[t.language].monaco, content: t.source };
  return { kind: "code", language: t.language, projectName: t.name, files: [f], activeFileId: f.id };
}

function extForLang(l: LangKey): string {
  const map: Record<LangKey, string> = {
    python: "py", javascript: "js", typescript: "ts", java: "java",
    c: "c", cpp: "cpp", csharp: "cs", php: "php", go: "go",
    rust: "rs", ruby: "rb", bash: "sh",
  };
  return map[l];
}

function loadState(): IdeState {
  if (typeof window === "undefined") return ensureActive(blankWeb());
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as IdeState;
      if (parsed.files?.length) return ensureActive(parsed);
    }
  } catch { /* ignore */ }
  return ensureActive(fromTemplate(TEMPLATES[1])); // start with Calculator
}

function ensureActive(s: IdeState): IdeState {
  if (s.files.find((f) => f.id === s.activeFileId)) return s;
  return { ...s, activeFileId: s.files[0]?.id ?? "" };
}

// --------------------------------------------------------------------------
// Component

function IdePlayground() {
  const [state, setState] = useState<IdeState>(() => blankWeb());
  const [appTheme, setAppTheme] = useAppTheme();
  const [editorTheme, setEditorTheme] = useEditorTheme();
  const [viewport, setViewport] = useState<ViewportKey>("mobile");
  const [bottomTab, setBottomTab] = useState<"preview" | "console" | "output">("preview");
  const [fullscreen, setFullscreen] = useState(false);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("");
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [consoleMsgs, setConsoleMsgs] = useState<ConsoleEntry[]>([]);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const consoleIdRef = useRef(0);

  // Hydrate
  useEffect(() => { setState(loadState()); }, []);
  // Autosave to localStorage (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(LS_KEY, JSON.stringify(state)); setSavedAt(Date.now()); } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [state]);

  // Preview console capture
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const m = parseConsoleMessage(e.data);
      if (!m) return;
      consoleIdRef.current += 1;
      setConsoleMsgs((p) => [...p, { id: consoleIdRef.current, level: m.level, text: m.text }].slice(-200));
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const activeFile = state.files.find((f) => f.id === state.activeFileId) ?? state.files[0];
  const palette = APP_THEMES[appTheme];

  // Build preview doc for web projects (debounced via key change)
  const previewDoc = useMemo(() => {
    if (state.kind !== "web") return "";
    const html = state.files.find((f) => f.name === "index.html")?.content ?? "";
    const css  = state.files.find((f) => f.name === "style.css")?.content  ?? "";
    const js   = state.files.find((f) => f.name === "script.js")?.content  ?? "";
    return buildPreviewDoc({ html, css, js });
  }, [state]);

  // --------- File ops ---------
  function updateActive(content: string) {
    setState((s) => ({ ...s, files: s.files.map((f) => f.id === s.activeFileId ? { ...f, content } : f) }));
  }
  function addFile(name: string) {
    const language = monacoLangFromName(name);
    const f: IdeFile = { id: uid(), name, language, content: "" };
    setState((s) => ({ ...s, files: [...s.files, f], activeFileId: f.id }));
  }
  function deleteFile(id: string) {
    setState((s) => {
      if (s.files.length <= 1) { toast.error("Project must have at least one file"); return s; }
      const files = s.files.filter((f) => f.id !== id);
      return { ...s, files, activeFileId: id === s.activeFileId ? files[0].id : s.activeFileId };
    });
  }
  function renameFile(id: string, name: string) {
    setState((s) => ({ ...s, files: s.files.map((f) => f.id === id ? { ...f, name, language: monacoLangFromName(name) } : f) }));
  }
  function loadTemplate(t: Template) {
    setState(ensureActive(fromTemplate(t)));
    setTemplatesOpen(false);
    setConsoleMsgs([]);
    setOutput(""); setStdout(""); setStderr(""); setExitCode(null);
    setBottomTab(t.kind === "web" ? "preview" : "output");
    toast.success(`Loaded ${t.name}`);
  }
  function newBlank(kind: Kind) {
    if (kind === "web") setState(ensureActive(fromTemplate(TEMPLATES.find((t) => t.id === "blank-web")!)));
    else {
      const lang: LangKey = "python";
      const f: IdeFile = { id: uid(), name: `main.${extForLang(lang)}`, language: LANGUAGES[lang].monaco, content: LANGUAGES[lang].starter };
      setState({ kind: "code", language: lang, projectName: "Untitled", files: [f], activeFileId: f.id });
    }
    setTemplatesOpen(false);
  }

  // --------- Run ---------
  async function handleRun() {
    if (running) return;
    if (state.kind === "web") {
      setConsoleMsgs([]);
      setBottomTab("preview");
      // bump key by toggling a ref-equivalent state — easiest: re-set state to clone
      setState((s) => ({ ...s }));
      toast.success("Preview reloaded");
      return;
    }
    setRunning(true); setOutput("Running…"); setStdout(""); setStderr(""); setExitCode(null);
    setBottomTab("output");
    try {
      const r = await runCode(state.language, activeFile.content, "", "wandbox", {
        fallback: true,
        onFallback: (info) => toast.warning(`${PROVIDERS[info.from].label} → ${PROVIDERS[info.to].label}`, { description: info.reason }),
      });
      setOutput(r.output || "(no output)"); setStdout(r.stdout); setStderr(r.stderr); setExitCode(r.code);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setOutput(`Error: ${msg}`); setStderr(msg);
      toast.error("Run failed", { description: msg });
    } finally { setRunning(false); }
  }

  function handleShare() {
    try {
      const payload = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
      const url = `${location.origin}${location.pathname}#share=${payload}`;
      navigator.clipboard.writeText(url);
      toast.success("Share link copied", { description: "Anyone with the link can open this project." });
    } catch { toast.error("Could not create share link"); }
  }

  // Restore from share hash
  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.location.hash.match(/#share=(.+)/);
    if (!m) return;
    try {
      const json = decodeURIComponent(escape(atob(m[1])));
      const parsed = JSON.parse(json) as IdeState;
      if (parsed.files?.length) { setState(ensureActive(parsed)); toast.success("Loaded shared project"); }
      window.history.replaceState(null, "", window.location.pathname);
    } catch { /* ignore */ }
  }, []);

  // --------- Editor ---------
  const onMount = useCallback<OnMount>((ed, mn) => {
    editorRef.current = ed; monacoRef.current = mn;
    registerEditorThemes(mn);
  }, []);

  function insertQuickKey(k: string) {
    const ed = editorRef.current; if (!ed) return;
    ed.focus();
    const sel = ed.getSelection();
    if (!sel) return;
    const text = k === "Tab" ? "  " : k;
    ed.executeEdits("quick", [{ range: sel, text, forceMoveMarkers: true }]);
  }

  // --------- Render ---------
  const headerHeight = fullscreen ? 0 : 56;

  return (
    <div className="flex flex-col" style={{
      height: "calc(100vh - 3.5rem)",
      background: palette.bg, color: palette.text,
    }}>
      {/* Top bar */}
      {!fullscreen && (
        <header className="flex h-14 shrink-0 items-center gap-2 overflow-x-auto border-b px-3"
          style={{ borderColor: palette.border, background: palette.panel }}>
          <button onClick={() => setFilesOpen(true)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
            style={{ background: "linear-gradient(160deg,#4f8cff,#7e5bff)", color: "#fff" }}
            title="Files">
            <FolderOpen size={16} />
          </button>
          <div className="flex min-w-0 flex-col leading-tight">
            <Input
              value={state.projectName}
              onChange={(e) => setState((s) => ({ ...s, projectName: e.target.value }))}
              className="h-7 w-44 shrink-0 border-0 bg-transparent px-0 text-sm font-semibold focus-visible:ring-0"
              style={{ color: palette.text }}
            />
            <span className="truncate text-[10px]" style={{ color: palette.subtle }}>
              {state.kind === "web" ? "HTML · CSS · JS" : LANGUAGES[state.language].label}
              {savedAt && <> · Saved</>}
            </span>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setTemplatesOpen(true)} title="Templates">
              <LayoutGrid size={16} />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleShare} title="Share">
              <Share2 size={16} />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAiOpen(true)} title="AI Assistant">
              <Sparkles size={16} />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSettingsOpen(true)} title="Settings">
              <SettingsIcon size={16} />
            </Button>
            <Button size="sm" onClick={handleRun} disabled={running}
              className="ml-1 h-9 rounded-xl px-4"
              style={{ background: "linear-gradient(160deg,#5fd38a,#4f8cff)", color: "#001028" }}>
              {running ? <Loader2 className="mr-1 animate-spin" size={14} /> : <Play size={14} className="mr-1" />}
              Run
            </Button>
          </div>
        </header>
      )}

      {/* Tab strip */}
      {!fullscreen && (
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b px-2 py-1"
          style={{ borderColor: palette.border, background: palette.panel }}>
          {state.files.map((f) => (
            <button key={f.id}
              onClick={() => setState((s) => ({ ...s, activeFileId: f.id }))}
              className={`group inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                f.id === state.activeFileId ? "" : "opacity-60 hover:opacity-100"
              }`}
              style={{
                background: f.id === state.activeFileId ? palette.bg : "transparent",
                color: palette.text,
                border: `1px solid ${f.id === state.activeFileId ? palette.border : "transparent"}`,
              }}>
              <FileIcon name={f.name} />
              <span>{f.name}</span>
              {state.files.length > 1 && (
                <span onClick={(e) => { e.stopPropagation(); deleteFile(f.id); }}
                  className="ml-1 hidden h-4 w-4 place-items-center rounded text-[10px] hover:bg-white/10 group-hover:grid">
                  <X size={10} />
                </span>
              )}
            </button>
          ))}
          <button onClick={() => setFilesOpen(true)}
            className="ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-white/10"
            style={{ color: palette.subtle }} title="Add file">
            <Plus size={14} />
          </button>
        </div>
      )}

      {/* Editor + bottom panel */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1" style={{ background: palette.bg }}>
          <Editor
            key={activeFile?.id}
            height="100%"
            language={activeFile?.language}
            value={activeFile?.content}
            theme={EDITOR_THEMES[editorTheme].monaco}
            onChange={(v) => updateActive(v ?? "")}
            onMount={onMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14, lineHeight: 22,
              tabSize: 2, scrollBeyondLastLine: false, automaticLayout: true,
              wordWrap: "on", bracketPairColorization: { enabled: true },
              padding: { top: 12, bottom: 12 }, smoothScrolling: true,
              cursorBlinking: "smooth", renderLineHighlight: "all",
            }}
          />
        </div>

        {/* Quick key bar */}
        {!fullscreen && (
          <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-t px-2 py-1.5"
            style={{ borderColor: palette.border, background: palette.panel }}>
            {QUICK_KEYS.map((k) => (
              <button key={k} onClick={() => insertQuickKey(k)}
                className="h-8 shrink-0 rounded-lg px-2.5 font-mono text-xs"
                style={{ background: palette.bg, color: palette.text, border: `1px solid ${palette.border}` }}>
                {k}
              </button>
            ))}
            <button onClick={() => editorRef.current?.trigger("kb", "undo", null)}
              className="ml-auto h-8 shrink-0 rounded-lg px-3 text-xs"
              style={{ background: palette.bg, color: palette.text, border: `1px solid ${palette.border}` }}>↶ Undo</button>
            <button onClick={() => editorRef.current?.trigger("kb", "redo", null)}
              className="h-8 shrink-0 rounded-lg px-3 text-xs"
              style={{ background: palette.bg, color: palette.text, border: `1px solid ${palette.border}` }}>↷ Redo</button>
            <button onClick={() => setFullscreen(true)}
              className="h-8 shrink-0 rounded-lg px-2 text-xs"
              style={{ background: palette.bg, color: palette.text, border: `1px solid ${palette.border}` }}
              title="Fullscreen"><Maximize2 size={12} /></button>
          </div>
        )}

        {/* Bottom panel */}
        {!fullscreen && (
          <div className="flex shrink-0 flex-col border-t" style={{ borderColor: palette.border, background: palette.panel, height: 320 }}>
            <div className="flex items-center gap-1 border-b px-2 py-1" style={{ borderColor: palette.border }}>
              {state.kind === "web" && (
                <TabBtn active={bottomTab === "preview"} onClick={() => setBottomTab("preview")} palette={palette}>
                  <Smartphone size={12} className="mr-1" /> Preview
                </TabBtn>
              )}
              <TabBtn active={bottomTab === "console"} onClick={() => setBottomTab("console")} palette={palette}>
                <Terminal size={12} className="mr-1" /> Console {consoleMsgs.length > 0 && <span className="ml-1 text-[10px] opacity-70">{consoleMsgs.length}</span>}
              </TabBtn>
              {state.kind === "code" && (
                <TabBtn active={bottomTab === "output"} onClick={() => setBottomTab("output")} palette={palette}>
                  <Terminal size={12} className="mr-1" /> Output {exitCode !== null && <span className="ml-1 text-[10px] opacity-70">exit {exitCode}</span>}
                </TabBtn>
              )}
              <div className="ml-auto flex items-center gap-1">
                {bottomTab === "preview" && state.kind === "web" && (
                  <>
                    {(Object.keys(PREVIEW_VIEWPORTS) as ViewportKey[]).map((v) => (
                      <button key={v} onClick={() => setViewport(v)}
                        className="grid h-7 w-7 place-items-center rounded-md"
                        style={{ background: viewport === v ? palette.bg : "transparent", color: palette.text, border: `1px solid ${viewport === v ? palette.border : "transparent"}` }}
                        title={PREVIEW_VIEWPORTS[v].label}>
                        {v === "mobile" ? <Smartphone size={12} /> : v === "tablet" ? <Tablet size={12} /> : <Monitor size={12} />}
                      </button>
                    ))}
                    <button onClick={() => setState((s) => ({ ...s }))}
                      className="grid h-7 w-7 place-items-center rounded-md hover:bg-white/10" title="Reload">
                      <RefreshCw size={12} />
                    </button>
                  </>
                )}
                {bottomTab === "console" && (
                  <button onClick={() => setConsoleMsgs([])}
                    className="inline-flex h-7 items-center rounded-md px-2 text-[11px] hover:bg-white/10">
                    <Eraser size={12} className="mr-1" /> Clear
                  </button>
                )}
                {bottomTab === "output" && (output || stderr) && (
                  <button onClick={() => { navigator.clipboard.writeText(output); toast.success("Output copied"); }}
                    className="inline-flex h-7 items-center rounded-md px-2 text-[11px] hover:bg-white/10">
                    <Copy size={12} className="mr-1" /> Copy
                  </button>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {bottomTab === "preview" && state.kind === "web" && (
                <PreviewFrame doc={previewDoc} viewport={viewport} bg={palette.bg} />
              )}
              {bottomTab === "console" && (
                <ConsolePanel msgs={consoleMsgs} subtle={palette.subtle} />
              )}
              {bottomTab === "output" && (
                <pre className="m-0 h-full overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed"
                  style={{ background: "#000", color: "#7ce38b" }}>
                  {output || "Tap Run to execute your code."}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen exit */}
      {fullscreen && (
        <button onClick={() => setFullscreen(false)}
          className="fixed right-3 top-3 z-50 grid h-10 w-10 place-items-center rounded-full shadow-lg"
          style={{ background: palette.panel, color: palette.text, border: `1px solid ${palette.border}` }}>
          <Minimize2 size={16} />
        </button>
      )}

      {/* Files sheet */}
      <Sheet open={filesOpen} onOpenChange={setFilesOpen}>
        <SheetContent side="left" className="w-[320px] p-0" style={{ background: palette.panel, color: palette.text, borderColor: palette.border }}>
          <SheetHeader className="border-b px-4 py-3" style={{ borderColor: palette.border }}>
            <SheetTitle style={{ color: palette.text }}>Files</SheetTitle>
          </SheetHeader>
          <div className="p-3">
            <div className="mb-2 flex gap-1">
              <AddFileButton onAdd={addFile} palette={palette} />
              <Button size="sm" variant="ghost" className="flex-1" onClick={() => setTemplatesOpen(true)}>
                <LayoutGrid size={14} className="mr-1" /> Templates
              </Button>
            </div>
            <ul className="grid gap-1">
              {state.files.map((f) => (
                <li key={f.id} className="flex items-center gap-2 rounded-md px-2 py-1.5"
                  style={{ background: f.id === state.activeFileId ? palette.bg : "transparent" }}>
                  <FileIcon name={f.name} />
                  <button className="flex-1 truncate text-left text-sm"
                    onClick={() => { setState((s) => ({ ...s, activeFileId: f.id })); setFilesOpen(false); }}>
                    {f.name}
                  </button>
                  <button onClick={() => {
                    const name = prompt("Rename file", f.name);
                    if (name && name !== f.name) renameFile(f.id, name);
                  }} className="opacity-60 hover:opacity-100" title="Rename">✎</button>
                  {state.files.length > 1 && (
                    <button onClick={() => deleteFile(f.id)} className="opacity-60 hover:opacity-100" title="Delete">
                      <Trash2 size={12} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </SheetContent>
      </Sheet>

      {/* Templates sheet */}
      <Sheet open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <SheetContent side="bottom" className="h-[80vh] p-0" style={{ background: palette.panel, color: palette.text, borderColor: palette.border }}>
          <SheetHeader className="border-b px-4 py-3" style={{ borderColor: palette.border }}>
            <SheetTitle style={{ color: palette.text }}>Start from a template</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 overflow-auto p-3 sm:grid-cols-3">
            <button onClick={() => newBlank("web")}
              className="flex flex-col items-start gap-1 rounded-xl border p-3 text-left"
              style={{ borderColor: palette.border, background: palette.bg }}>
              <span className="text-2xl">🌐</span>
              <span className="text-sm font-semibold">Blank Web</span>
              <span className="text-[11px]" style={{ color: palette.subtle }}>HTML + CSS + JS</span>
            </button>
            {TEMPLATES.map((t) => (
              <button key={t.id} onClick={() => loadTemplate(t)}
                className="flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition hover:-translate-y-0.5"
                style={{ borderColor: palette.border, background: palette.bg }}>
                <span className="text-2xl">{t.emoji}</span>
                <span className="text-sm font-semibold">{t.name}</span>
                <span className="line-clamp-2 text-[11px]" style={{ color: palette.subtle }}>{t.description}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* AI sheet */}
      <Sheet open={aiOpen} onOpenChange={setAiOpen}>
        <SheetContent side="bottom" className="h-[85vh] overflow-hidden p-0" style={{ background: palette.panel, color: palette.text, borderColor: palette.border }}>
          <SheetHeader className="border-b px-4 py-3" style={{ borderColor: palette.border }}>
            <SheetTitle style={{ color: palette.text }}>
              <Sparkles size={14} className="mr-1 inline" /> AI Assistant
            </SheetTitle>
          </SheetHeader>
          <div className="h-full overflow-auto p-2">
            <AiDebugPanel
              language={state.kind === "web" ? (activeFile?.language as LangKey) ?? "javascript" : state.language}
              code={activeFile?.content ?? ""}
              stdout={stdout}
              stderr={stderr}
              exitCode={exitCode}
              provider="wandbox"
              stdin=""
              onApplyFix={(next) => updateActive(next)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Settings sheet */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right" className="w-[320px] p-0" style={{ background: palette.panel, color: palette.text, borderColor: palette.border }}>
          <SheetHeader className="border-b px-4 py-3" style={{ borderColor: palette.border }}>
            <SheetTitle style={{ color: palette.text }}>Settings</SheetTitle>
          </SheetHeader>
          <div className="grid gap-4 p-4">
            <SettingRow label="App theme">
              <Select value={appTheme} onValueChange={(v) => setAppTheme(v as AppThemeKey)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(APP_THEMES) as AppThemeKey[]).map((k) => (
                    <SelectItem key={k} value={k}>{APP_THEMES[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>
            <SettingRow label="Editor theme">
              <Select value={editorTheme} onValueChange={(v) => setEditorTheme(v as EditorThemeKey)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(EDITOR_THEMES) as EditorThemeKey[]).map((k) => (
                    <SelectItem key={k} value={k}>{EDITOR_THEMES[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>
            {state.kind === "code" && (
              <SettingRow label="Language">
                <Select value={state.language} onValueChange={(v) => {
                  const lang = v as LangKey;
                  setState((s) => {
                    const f = s.files[0];
                    return { ...s, language: lang, files: [{ ...f, name: `main.${extForLang(lang)}`, language: LANGUAGES[lang].monaco, content: LANGUAGES[lang].starter }], activeFileId: f.id };
                  });
                }}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(LANGUAGES) as LangKey[]).map((k) => (
                      <SelectItem key={k} value={k}>{LANGUAGES[k].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>
            )}
            <SettingRow label="Editor">
              <button onClick={() => setFullscreen(true)}
                className="inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm"
                style={{ borderColor: palette.border }}>
                <Maximize2 size={14} className="mr-1" /> Fullscreen
              </button>
            </SettingRow>
            <div className="rounded-md border p-3 text-xs" style={{ borderColor: palette.border, color: palette.subtle }}>
              Projects autosave to this device. Use Share to copy a link you can open anywhere.
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// --------------------------------------------------------------------------
// Sub-components

function TabBtn({ active, onClick, children, palette }: { active: boolean; onClick: () => void; children: React.ReactNode; palette: typeof APP_THEMES[AppThemeKey] }) {
  return (
    <button onClick={onClick}
      className="inline-flex h-7 items-center rounded-md px-2.5 text-[11px] font-medium"
      style={{
        background: active ? palette.bg : "transparent",
        color: palette.text,
        border: `1px solid ${active ? palette.border : "transparent"}`,
      }}>
      {children}
    </button>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-medium opacity-70">{label}</label>
      {children}
    </div>
  );
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    html: "🟧", css: "🟦", js: "🟨", ts: "🔷", json: "📦",
    py: "🐍", java: "☕", kt: "🟪", php: "🐘", rb: "💎",
    go: "🐹", rs: "🦀", c: "🔧", cpp: "🔧", cs: "🔷", sh: "🟩",
  };
  return <span className="text-xs">{map[ext ?? ""] ?? "📄"}</span>;
}

function AddFileButton({ onAdd, palette }: { onAdd: (name: string) => void; palette: typeof APP_THEMES[AppThemeKey] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  if (!open) {
    return (
      <Button size="sm" className="flex-1" onClick={() => setOpen(true)}
        style={{ background: "linear-gradient(160deg,#4f8cff,#7e5bff)", color: "#fff" }}>
        <FilePlus2 size={14} className="mr-1" /> New file
      </Button>
    );
  }
  return (
    <form className="flex flex-1 gap-1" onSubmit={(e) => {
      e.preventDefault();
      const n = name.trim(); if (!n) return;
      onAdd(n); setName(""); setOpen(false);
    }}>
      <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="filename.ext" className="h-8 text-sm" />
      <Button type="submit" size="sm" style={{ background: palette.bg, color: palette.text, border: `1px solid ${palette.border}` }}>Add</Button>
    </form>
  );
}

function PreviewFrame({ doc, viewport, bg }: { doc: string; viewport: ViewportKey; bg: string }) {
  const v = PREVIEW_VIEWPORTS[viewport];
  // scale down so device viewport fits the panel width
  const [scale, setScale] = useState(1);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function update() {
      if (!wrapRef.current) return;
      const w = wrapRef.current.clientWidth - 24;
      const h = wrapRef.current.clientHeight - 24;
      setScale(Math.min(1, w / v.w, h / v.h));
    }
    update();
    const ro = new ResizeObserver(update);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [viewport, v.w, v.h]);
  return (
    <div ref={wrapRef} className="flex h-full w-full items-center justify-center"
      style={{ background: bg, backgroundImage: "radial-gradient(circle at center, rgba(255,255,255,.04) 1px, transparent 1px)", backgroundSize: "14px 14px" }}>
      <div style={{
        width: v.w, height: v.h,
        transform: `scale(${scale})`, transformOrigin: "center",
        boxShadow: "0 20px 60px rgba(0,0,0,.6)", borderRadius: 18,
        overflow: "hidden", background: "#fff",
      }}>
        <iframe title="preview" srcDoc={doc} sandbox="allow-scripts allow-forms allow-modals"
          style={{ width: v.w, height: v.h, border: 0, display: "block" }} />
      </div>
    </div>
  );
}

function ConsolePanel({ msgs, subtle }: { msgs: ConsoleEntry[]; subtle: string }) {
  if (msgs.length === 0) return (
    <div className="grid h-full place-items-center p-4 text-center text-xs" style={{ color: subtle }}>
      Console output from your preview will appear here.
    </div>
  );
  const color: Record<string, string> = { error: "#ff6f8a", warn: "#ffb86c", info: "#7eb2ff", debug: "#9aa3cf", log: "#e8ecff" };
  return (
    <div className="h-full overflow-auto p-2 font-mono text-[11px] leading-relaxed">
      {msgs.map((m) => (
        <div key={m.id} className="flex gap-2 border-b border-white/5 px-1 py-1">
          <span className="w-12 shrink-0 uppercase opacity-60" style={{ color: color[m.level] ?? color.log }}>{m.level}</span>
          <span className="min-w-0 break-words" style={{ color: color[m.level] ?? color.log }}>{m.text}</span>
        </div>
      ))}
    </div>
  );
}

function monacoLangFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    html: "html", htm: "html",
    css: "css", scss: "scss",
    js: "javascript", mjs: "javascript", cjs: "javascript",
    ts: "typescript", tsx: "typescript",
    json: "json", md: "markdown",
    py: "python", java: "java", kt: "kotlin",
    php: "php", rb: "ruby", go: "go", rs: "rust",
    c: "c", h: "c", cpp: "cpp", cs: "csharp", sh: "shell",
    sql: "sql", xml: "xml",
  };
  return map[ext ?? ""] ?? "plaintext";
}

import { createFileRoute } from "@tanstack/react-router";
import Editor, { type OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play, Share2, Sparkles, Settings as SettingsIcon, Loader2, Copy,
  Plus, FilePlus2, Trash2, Smartphone, Tablet, Monitor, Maximize2, Minimize2,
  Eraser, FolderOpen, X, RefreshCw, Terminal, LayoutGrid, Globe, Database as DbIcon,
  FolderPlus, Folder, FolderOpen as FolderOpenIcon, Upload, ChevronRight, ChevronDown, Image as ImageIcon, FileText,
  Download, Pencil, Sun, Moon, Search as SearchIcon, Command as CommandIcon, Replace as ReplaceIcon,
  Images, ShieldCheck, GitFork, Wand2,
} from "lucide-react";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { buildGraph } from "@/lib/playground/relations";
import { buildManifest } from "@/lib/playground/manifest";
import { AssetManager } from "@/components/playground/AssetManager";
import { DepGraph } from "@/components/playground/DepGraph";
import { ValidationReport } from "@/components/playground/ValidationReport";
import JSZip from "jszip";
import { MULTI_TEMPLATES, type MultiTemplate } from "@/lib/playground/multi-templates";
import { buildAndroidZip, buildIosZip, buildFlutterZip, detectNativeTarget, downloadBlob, type NativeTarget } from "@/lib/playground/mobile-export";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { TEMPLATES, WEB_TEMPLATES, templatesForTrack, type Template, type Track } from "@/lib/playground/templates";
import {
  buildPreviewDoc, buildProjectOverviewDoc, parseConsoleMessage, parseStorageMessage,
  PREVIEW_VIEWPORTS, type ViewportKey,
} from "@/lib/playground/web-bundle";
import { TemplateIcon, LanguageIcon, FileExtIcon } from "@/lib/playground/icons";
import { ApiTester } from "@/components/playground/ApiTester";
import { DbConsole } from "@/components/playground/DbConsole";
import { summarize as summarizeSmoke, diffRuns as diffSmokeRuns } from "@/lib/playground/smoke-test";

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
  /** Filters the templates sheet ("code" | "web" | "mobile"). Defaults to defaultKind. */
  track?: Track;
}

// --------------------------------------------------------------------------
// Types

type Kind = "web" | "code";

interface IdeAsset { mime: string; dataUrl: string; size: number }
interface IdeFile {
  id: string;
  /** Full path within the project, e.g. "src/main.kt" or "assets/logo.png". */
  path: string;
  /** Display basename (derived from path; kept for legacy state). */
  name: string;
  language: string;      // monaco language id
  content: string;       // text content; "" if asset
  asset?: IdeAsset;      // binary asset (image/pdf)
}

interface IdeState {
  kind: Kind;
  language: LangKey;     // for "code" projects
  projectName: string;
  files: IdeFile[];
  folders?: string[];    // explicit folder paths so empty folders persist
  activeFileId: string;
}

interface ConsoleEntry { id: number; level: string; text: string }
interface UploadItem { id: string; name: string; size: number; status: "pending" | "done" | "error"; error?: string }

const DEFAULT_LS_KEY = "playground-ide:v1";
const QUICK_KEYS = ["Tab", "{", "}", "(", ")", "[", "]", ";", "=", "<", ">", "\"", "/"] as const;

function uid(): string { return Math.random().toString(36).slice(2, 10); }

function basename(p: string): string { return p.split("/").pop() || p; }
function dirname(p: string): string { const i = p.lastIndexOf("/"); return i < 0 ? "" : p.slice(0, i); }

function mkFile(path: string, content: string, language?: string): IdeFile {
  const name = basename(path);
  return { id: uid(), path, name, language: language ?? monacoLangFromName(name), content };
}

function blankWeb(): IdeState {
  const t = WEB_TEMPLATES.find((w) => w.id === "blank-web")!;
  return {
    kind: "web", language: "javascript", projectName: t.name,
    files: [
      mkFile("index.html", t.files.html, "html"),
      mkFile("style.css", t.files.css, "css"),
      mkFile("script.js", t.files.js, "javascript"),
    ],
    folders: ["assets"],
    activeFileId: "",
  };
}

function fromMultiTemplate(t: MultiTemplate): IdeState {
  const files = t.files.map((f) => mkFile(f.path, f.content));
  const active = files.find((f) => f.path === t.activePath) ?? files[0];
  const kind: Kind = t.tracks.includes("web") ? "web" : "code";
  return {
    kind, language: t.language, projectName: t.name,
    files, folders: [...t.folders, "assets"].filter((v, i, a) => a.indexOf(v) === i),
    activeFileId: active.id,
  };
}

function fromTemplate(t: Template): IdeState {
  if (t.kind === "web") {
    const files = [
      mkFile("index.html", t.files.html, "html"),
      mkFile("style.css", t.files.css, "css"),
      mkFile("script.js", t.files.js, "javascript"),
    ];
    return { kind: "web", language: "javascript", projectName: t.name, files, folders: ["assets"], activeFileId: files[0].id };
  }
  const ext = extForLang(t.language);
  const f = mkFile(`main.${ext}`, t.source, LANGUAGES[t.language].monaco);
  return { kind: "code", language: t.language, projectName: t.name, files: [f], folders: ["assets"], activeFileId: f.id };
}

function extForLang(l: LangKey): string {
  const map: Record<LangKey, string> = {
    python: "py", javascript: "js", typescript: "ts", java: "java",
    c: "c", cpp: "cpp", csharp: "cs", php: "php", go: "go",
    rust: "rs", ruby: "rb", bash: "sh",
    kotlin: "kt", swift: "swift", dart: "dart", scala: "scala", objc: "m", sql: "sql",
  };
  return map[l];
}

function loadState(storageKey: string, defaultKind: "web" | "code", defaultLanguage: LangKey, defaultProjectName?: string, track?: Track): IdeState {
  if (typeof window === "undefined") return ensureActive(blankWeb());
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as IdeState;
      if (parsed.files?.length) {
        // Back-compat: ensure every file has a `path`.
        const files = parsed.files.map((f) => ({ ...f, path: f.path ?? f.name, name: basename(f.path ?? f.name) }));
        return ensureActive({ ...parsed, files, folders: parsed.folders ?? ["assets"] });
      }
    }
  } catch { /* ignore */ }
  // Mobile track defaults to the Kotlin Android starter; other tracks keep their previous default.
  if (track === "mobile") {
    const m = MULTI_TEMPLATES.find((t) => t.id === "android-kotlin-app")!;
    return ensureActive({ ...fromMultiTemplate(m), projectName: defaultProjectName ?? m.name });
  }
  if (defaultKind === "code") {
    const f = mkFile(`main.${extForLang(defaultLanguage)}`, LANGUAGES[defaultLanguage].starter, LANGUAGES[defaultLanguage].monaco);
    return { kind: "code", language: defaultLanguage, projectName: defaultProjectName ?? "Untitled", files: [f], folders: ["assets"], activeFileId: f.id };
  }
  const base = fromTemplate(TEMPLATES[1]); // Calculator web template
  return ensureActive(defaultProjectName ? { ...base, projectName: defaultProjectName } : base);
}

function ensureActive(s: IdeState): IdeState {
  if (s.files.find((f) => f.id === s.activeFileId)) return s;
  return { ...s, activeFileId: s.files[0]?.id ?? "" };
}

// --------------------------------------------------------------------------
// Component

export function IdePlayground({ defaultKind = "web", storageKey = DEFAULT_LS_KEY, defaultLanguage = "python", defaultProjectName, track }: IdePlaygroundProps = {}) {
  const effectiveTrack: Track = track ?? (defaultKind === "code" ? "code" : "web");
  const trackTemplates = useMemo(() => templatesForTrack(effectiveTrack), [effectiveTrack]);
  const [state, setState] = useState<IdeState>(() => blankWeb());
  const [appTheme, setAppTheme] = useAppTheme();
  const [editorTheme, setEditorTheme] = useEditorTheme();
  const [viewport, setViewport] = useState<ViewportKey>("mobile");
  const [bottomTab, setBottomTab] = useState<"preview" | "console" | "errors" | "output">("preview");
  const [fullscreen, setFullscreen] = useState(false);
  const [previewMax, setPreviewMax] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"stacked" | "split">("stacked");
  const [panelHeight, setPanelHeight] = useState<number>(320);
  const [splitWidth, setSplitWidth] = useState<number>(50); // percent for preview pane
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("");
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [lastRun, setLastRun] = useState<{ provider: string; timeSec?: number | null; memoryKb?: number | null; status?: string | null } | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiOpen, setApiOpen] = useState(false);
  const [dbOpen, setDbOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [validateOpen, setValidateOpen] = useState(false);
  const [formatOnSave, setFormatOnSaveState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem("playground:format-on-save:v1") === "1"; } catch { return false; }
  });
  const [recentPaths, setRecentPaths] = useState<string[]>([]);
  const [consoleMsgs, setConsoleMsgs] = useState<ConsoleEntry[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [persistPreviewStorage, setPersistPreviewStorage] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try { return localStorage.getItem("playground:persist-preview-storage:v1") !== "0"; } catch { return true; }
  });
  const [previewStorage, setPreviewStorage] = useState<{ local: Record<string, string>; session: Record<string, string> }>({ local: {}, session: {} });
  const [smokeRunning, setSmokeRunning] = useState(false);
  const [smokeProgress, setSmokeProgress] = useState<{ done: number; total: number; current: string }>({ done: 0, total: 0, current: "" });
  const [smokeResults, setSmokeResults] = useState<import("@/lib/playground/smoke-test").SmokeResult[] | null>(null);
  const [smokePrevResults, setSmokePrevResults] = useState<import("@/lib/playground/smoke-test").SmokeResult[] | null>(null);
  const [smokeRanAt, setSmokeRanAt] = useState<number | null>(null);
  const [smokePlatformFilter, setSmokePlatformFilter] = useState<"all" | "web" | "mobile">("all");
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const consoleIdRef = useRef(0);
  const storageStorageKey = `${storageKey}::preview-storage`;

  // Hydrate
  useEffect(() => {
    const s = loadState(storageKey, defaultKind, defaultLanguage, defaultProjectName, effectiveTrack);
    setState(s);
    setBottomTab(s.kind === "web" || effectiveTrack === "mobile" ? "preview" : "output");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Autosave to localStorage (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify(state)); setSavedAt(Date.now()); } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [state, storageKey]);

  // Recent files: hydrate + track active file changes
  const recentKey = `${storageKey}:recent`;
  useEffect(() => {
    try { const raw = localStorage.getItem(recentKey); if (raw) setRecentPaths(JSON.parse(raw)); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const f = state.files.find((x) => x.id === state.activeFileId);
    if (!f || f.asset) return;
    setRecentPaths((prev) => {
      const next = [f.path, ...prev.filter((p) => p !== f.path)].slice(0, 8);
      try { localStorage.setItem(recentKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [state.activeFileId, state.files, recentKey]);


  // Preview console + storage capture
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const m = parseConsoleMessage(e.data);
      if (m) {
        consoleIdRef.current += 1;
        setConsoleMsgs((p) => [...p, { id: consoleIdRef.current, level: m.level, text: m.text }].slice(-200));
        return;
      }
      const s = parseStorageMessage(e.data);
      if (s) setPreviewStorage((prev) => ({ ...prev, [s.kind]: s.snapshot }));
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Load + persist preview storage snapshot per project.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!persistPreviewStorage) { setPreviewStorage({ local: {}, session: {} }); return; }
    try {
      const raw = localStorage.getItem(storageStorageKey);
      if (raw) setPreviewStorage(JSON.parse(raw));
      else setPreviewStorage({ local: {}, session: {} });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageStorageKey, persistPreviewStorage]);
  useEffect(() => {
    if (typeof window === "undefined" || !persistPreviewStorage) return;
    try { localStorage.setItem(storageStorageKey, JSON.stringify(previewStorage)); } catch {}
  }, [previewStorage, storageStorageKey, persistPreviewStorage]);
  useEffect(() => {
    try { localStorage.setItem("playground:persist-preview-storage:v1", persistPreviewStorage ? "1" : "0"); } catch {}
  }, [persistPreviewStorage]);


  // Command palette ⌘K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleAppTheme() {
    const order: AppThemeKey[] = ["dark", "light", "amoled"];
    const i = order.indexOf(appTheme);
    setAppTheme(order[(i + 1) % order.length]);
  }
  function openFindReplace() {
    const ed = editorRef.current; if (!ed) return;
    ed.focus();
    ed.getAction("editor.action.startFindReplaceAction")?.run();
  }
  async function formatDocument(silent = false) {
    const ed = editorRef.current; if (!ed) return;
    if (!silent) ed.focus();
    const model = ed.getModel();
    if (model) {
      try {
        const { formatSource } = await import("@/lib/playground/format");
        const monacoLang = model.getLanguageId();
        const map: Record<string, Parameters<typeof formatSource>[0]> = {
          typescript: "typescript", javascript: "javascript", json: "json",
          css: "css", scss: "scss", less: "less", markdown: "markdown",
          yaml: "yaml", sql: "sql",
        };
        const lang = map[monacoLang];
        if (lang) {
          const out = await formatSource(lang, model.getValue());
          if (out != null && out !== model.getValue()) {
            const full = model.getFullModelRange();
            ed.executeEdits("format", [{ range: full, text: out, forceMoveMarkers: true }]);
            ed.pushUndoStop();
            if (!silent) toast.success("Formatted");
            return;
          }
        }
      } catch { /* fall back to Monaco */ }
    }
    const act = ed.getAction("editor.action.formatDocument");
    try { await act?.run(); if (!silent) toast.success("Formatted"); }
    catch { if (!silent) toast.error("Formatter not available for this language"); }
  }

  async function copyAsMarkdown() {
    const lines: string[] = [`# ${state.projectName}`, ""];
    for (const f of state.files) {
      if (f.asset) { lines.push(`- 📎 \`${f.path}\` (${f.asset.mime}, ${f.asset.size} B)`); continue; }
      const lang = monacoLangFromName(f.name);
      lines.push(`### \`${f.path}\``, "", "```" + lang, f.content, "```", "");
    }
    try { await navigator.clipboard.writeText(lines.join("\n")); toast.success("Project copied as Markdown"); }
    catch { toast.error("Clipboard unavailable"); }
  }

  async function importZip(file: File) {
    try {
      const zip = await JSZip.loadAsync(file);
      const newFiles: IdeFile[] = [];
      const folders = new Set<string>();
      let manifest: { name?: string; kind?: Kind; language?: LangKey } | null = null;
      const entries = Object.values(zip.files);
      for (const entry of entries) {
        if (entry.dir) { folders.add(entry.name.replace(/\/$/, "")); continue; }
        if (entry.name === "project.json") {
          try { manifest = JSON.parse(await entry.async("string")); } catch {}
          continue;
        }
        if (entry.name === "RELATIONS.md") continue;
        const ct = (entry as unknown as { _data?: { type?: string } })?._data?.type;
        const isText = /\.(html?|css|m?js|tsx?|jsx?|json|md|txt|sql|kt|java|swift|dart|py|rb|sh|c|cpp|cs|php|go|rs|scala|m|xml|yml|yaml|env)$/i.test(entry.name);
        if (isText) {
          const content = await entry.async("string");
          newFiles.push(mkFile(entry.name, content));
        } else {
          const blob = await entry.async("blob");
          const dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error("read failed")); r.readAsDataURL(blob); });
          const mime = blob.type || "application/octet-stream";
          newFiles.push({ id: uid(), path: entry.name, name: basename(entry.name), language: "plaintext", content: "", asset: { mime, dataUrl, size: blob.size } });
        }
      }
      if (!newFiles.length) { toast.error("ZIP has no usable files"); return; }
      const kind: Kind = manifest?.kind ?? (newFiles.some((f) => /\.html?$/i.test(f.path)) ? "web" : "code");
      const language: LangKey = manifest?.language ?? (kind === "web" ? "javascript" : state.language);
      const next: IdeState = {
        kind, language,
        projectName: manifest?.name ?? file.name.replace(/\.zip$/i, ""),
        files: newFiles,
        folders: Array.from(folders),
        activeFileId: newFiles[0].id,
      };
      setState(ensureActive(next));
      setTemplatesOpen(false);
      toast.success(`Imported ${newFiles.length} file${newFiles.length === 1 ? "" : "s"}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Import failed", { description: msg });
    }
  }

  const activeFile = state.files.find((f) => f.id === state.activeFileId) ?? state.files[0];
  const palette = APP_THEMES[appTheme];

  // File-relationship graph for the current project (asset-aware).
  const projectGraph = useMemo(
    () => buildGraph(state.files.map((f) => ({ path: f.path, content: f.content, isAsset: !!f.asset }))),
    [state.files],
  );


  // Build preview doc.
  // - Web projects: live HTML/CSS/JS sandbox with all files connected and assets inlined.
  // - Mobile / other multi-file code projects: a project-overview preview that shows
  //   every source file and every uploaded asset wired together (Kotlin/Swift/Dart
  //   have no public live runtime, so this gives users the same "everything is
  //   connected" feedback as the web preview).
  const previewDoc = useMemo(() => {
    if (state.kind === "web") {
      const byExt = (ext: string) =>
        state.files.filter((f) => !f.asset && f.path.toLowerCase().endsWith(ext));
      const htmlFile =
        state.files.find((f) => f.path === "index.html") ?? byExt(".html")[0];
      const html = htmlFile?.content ?? "";
      const css = byExt(".css").map((f) => `/* ${f.path} */\n${f.content}`).join("\n\n");
      const js = byExt(".js").map((f) => `// ${f.path}\n${f.content}`).join("\n;\n");
      const assets: Record<string, string> = {};
      for (const f of state.files) {
        if (f.asset?.dataUrl) {
          assets[f.path] = f.asset.dataUrl;
          assets[basename(f.path)] = f.asset.dataUrl;
        }
      }
      return buildPreviewDoc({ html, css, js, assets, storageSeed: previewStorage });
    }
    return buildProjectOverviewDoc({
      projectName: state.projectName,
      track: effectiveTrack === "mobile" ? "mobile" : "code",
      files: state.files.map((f) => ({
        path: f.path, language: f.language, content: f.content, asset: f.asset,
      })),
    });
    // We intentionally rebuild on `state` changes (auto-reload on edits) but
    // NOT on every `previewStorage` mutation — that would loop the iframe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, effectiveTrack]);




  // --------- File ops ---------
  function updateActive(content: string) {
    setState((s) => ({ ...s, files: s.files.map((f) => f.id === s.activeFileId ? { ...f, content } : f) }));
  }
  function addFile(path: string, folder = "") {
    const fullPath = folder ? `${folder.replace(/\/$/, "")}/${path}` : path;
    if (state.files.some((f) => f.path === fullPath)) { toast.error(`${fullPath} already exists`); return; }
    const f = mkFile(fullPath, "");
    setState((s) => ({ ...s, files: [...s.files, f], activeFileId: f.id }));
    // Auto-link: for web projects, offer to wire new .css/.js into index.html.
    if (state.kind === "web") autoLinkIntoHtml(fullPath);
  }
  function autoLinkIntoHtml(newPath: string) {
    const ext = newPath.toLowerCase().split(".").pop();
    if (ext !== "css" && ext !== "js") return;
    const html = state.files.find((f) => f.path === "index.html");
    if (!html) return;
    const tag = ext === "css"
      ? `  <link rel="stylesheet" href="${newPath}">\n`
      : `  <script src="${newPath}" defer></script>\n`;
    if (html.content.includes(newPath)) return;
    const updated = ext === "css" && /<\/head>/i.test(html.content)
      ? html.content.replace(/<\/head>/i, `${tag}</head>`)
      : ext === "js" && /<\/body>/i.test(html.content)
        ? html.content.replace(/<\/body>/i, `${tag}</body>`)
        : `${html.content}\n${tag}`;
    setState((s) => ({ ...s, files: s.files.map((f) => f.id === html.id ? { ...f, content: updated } : f) }));
    toast.success(`Linked ${newPath} into index.html`);
  }
  function addFolder(path: string) {
    const clean = path.replace(/^\/+|\/+$/g, "");
    if (!clean) return;
    setState((s) => {
      const folders = s.folders ?? [];
      if (folders.includes(clean)) { toast.error("Folder exists"); return s; }
      return { ...s, folders: [...folders, clean] };
    });
  }
  function deleteFolder(path: string) {
    const clean = path.replace(/^\/+|\/+$/g, "");
    setState((s) => {
      const remaining = s.files.filter((f) => f.path !== clean && !f.path.startsWith(clean + "/"));
      if (remaining.length === 0) { toast.error("Project must have at least one file"); return s; }
      const folders = (s.folders ?? []).filter((p) => p !== clean && !p.startsWith(clean + "/"));
      const activeStillThere = remaining.find((f) => f.id === s.activeFileId);
      return { ...s, files: remaining, folders, activeFileId: activeStillThere ? s.activeFileId : remaining[0].id };
    });
  }
  function deleteFile(id: string) {
    setState((s) => {
      if (s.files.length <= 1) { toast.error("Project must have at least one file"); return s; }
      const files = s.files.filter((f) => f.id !== id);
      return { ...s, files, activeFileId: id === s.activeFileId ? files[0].id : s.activeFileId };
    });
  }
  function renameFile(id: string, newPath: string): string | null {
    const clean = newPath.trim().replace(/^\/+|\/+$/g, "");
    if (!clean) return "Name cannot be empty";
    if (!/^[A-Za-z0-9._\-/]+$/.test(clean)) return "Use letters, numbers, . _ - /";
    if (state.files.some((f) => f.id !== id && f.path === clean)) return "A file with that path already exists";
    setState((s) => ({ ...s, files: s.files.map((f) => f.id === id ? { ...f, path: clean, name: basename(clean), language: monacoLangFromName(clean) } : f) }));
    return null;
  }
  async function uploadAssets(fileList: FileList, folder = "assets") {
    addFolder(folder);
    const arr = Array.from(fileList);
    if (!arr.length) return;
    const items: UploadItem[] = arr.map((f) => ({ id: uid(), name: f.name, size: f.size, status: "pending" }));
    setUploads((u) => [...u, ...items]);
    let done = 0, errors = 0;
    for (let i = 0; i < arr.length; i++) {
      const file = arr[i];
      const item = items[i];
      try {
        if (file.size > 2 * 1024 * 1024) throw new Error("Over 2MB limit");
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = () => reject(new Error("Read failed"));
          r.readAsDataURL(file);
        });
        const path = `${folder}/${file.name}`;
        const asset = { mime: file.type || "application/octet-stream", dataUrl, size: file.size };
        const f: IdeFile = { id: uid(), path, name: file.name, language: "plaintext", content: "", asset };
        setState((s) => {
          const without = s.files.filter((x) => x.path !== path);
          return { ...s, files: [...without, f], activeFileId: f.id };
        });
        setUploads((u) => u.map((x) => x.id === item.id ? { ...x, status: "done" } : x));
        done++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed";
        setUploads((u) => u.map((x) => x.id === item.id ? { ...x, status: "error", error: msg } : x));
        errors++;
      }
    }
    toast.success(`Uploaded ${done} asset${done === 1 ? "" : "s"}${errors ? ` · ${errors} failed` : ""}`);
    // Auto-clear completed entries after a short delay
    setTimeout(() => setUploads((u) => u.filter((x) => x.status === "pending")), 4000);
  }
  function clearUploads() { setUploads([]); }


  async function exportZip() {
    const zip = new JSZip();
    (state.folders ?? []).forEach((p) => zip.folder(p));
    for (const f of state.files) {
      if (f.asset) {
        const b64 = f.asset.dataUrl.split(",")[1] ?? "";
        zip.file(f.path, b64, { base64: true });
      } else {
        zip.file(f.path, f.content);
      }
    }
    // project.json manifest + relations summary
    const manifest = buildManifest({
      name: state.projectName, kind: state.kind, language: state.language,
      files: state.files.map((f) => ({ path: f.path, content: f.content, isAsset: !!f.asset })),
      folders: state.folders ?? [],
    });
    zip.file("project.json", JSON.stringify(manifest, null, 2));
    const relLines = ["# Project relations", "", `Total references: ${projectGraph.edges.length}`, `Broken: ${projectGraph.broken.length}`, ""];
    for (const e of projectGraph.edges) {
      relLines.push(`- ${e.from} → ${e.to} (${e.kind})${e.resolved ? "" : "  **broken**"}`);
    }
    zip.file("RELATIONS.md", relLines.join("\n"));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = state.projectName.replace(/[^a-z0-9._-]+/gi, "_") || "project";
    a.href = url; a.download = `${safeName}.zip`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Project exported as ZIP");
  }

  async function exportNative(target: NativeTarget) {
    try {
      const opts = {
        projectName: state.projectName,
        files: state.files.map((f) => ({
          path: f.path,
          content: f.content,
          isAsset: !!f.asset,
          base64: f.asset?.dataUrl.split(",")[1],
        })),
      };
      const blob =
        target === "android" ? await buildAndroidZip(opts)
          : target === "ios" ? await buildIosZip(opts)
          : await buildFlutterZip(opts);
      const safe = state.projectName.replace(/[^a-z0-9._-]+/gi, "_") || "MobileApp";
      const suffix = target === "android" ? "android" : target === "ios" ? "ios-xcode" : "flutter";
      downloadBlob(blob, `${safe}-${suffix}.zip`);
      const label = target === "android" ? "Android Studio" : target === "ios" ? "Xcode" : "Flutter";
      toast.success(`${label} project exported`, { description: "Unzip and open in your local IDE." });
    } catch (e) {
      toast.error("Export failed", { description: e instanceof Error ? e.message : String(e) });
    }
  }

  function loadTemplate(t: Template) {
    setState(ensureActive(fromTemplate(t)));
    setTemplatesOpen(false);
    setConsoleMsgs([]);
    setOutput(""); setStdout(""); setStderr(""); setExitCode(null);
    setBottomTab(t.kind === "web" ? "preview" : "output");
    toast.success(`Loaded ${t.name}`);
  }
  function loadMultiTemplate(t: MultiTemplate) {
    setState(ensureActive(fromMultiTemplate(t)));
    setTemplatesOpen(false);
    setConsoleMsgs([]);
    setOutput(""); setStdout(""); setStderr(""); setExitCode(null);
    setBottomTab(t.tracks.includes("web") ? "preview" : "output");
    toast.success(`Loaded ${t.name}`);
  }
  function newBlank(kind: Kind) {
    if (kind === "web") setState(ensureActive(fromTemplate(TEMPLATES.find((t) => t.id === "blank-web")!)));
    else {
      const lang: LangKey = "python";
      const f = mkFile(`main.${extForLang(lang)}`, LANGUAGES[lang].starter, LANGUAGES[lang].monaco);
      setState({ kind: "code", language: lang, projectName: "Untitled", files: [f], folders: ["assets"], activeFileId: f.id });
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
    const spec = LANGUAGES[state.language];
    if (spec.runnable === false) {
      const info = `${spec.label} runs in snippet mode — no free online executor is available for this language.\n\nWhat you can do:\n• Use the AI assistant below to Explain, Convert (e.g. to Python/JS), Generate tests, or Document the code.\n• Copy the code into your local toolchain (Xcode for Objective-C, the Dart SDK for Dart, etc.) to execute it.\n\nThe editor, AI tools, file tree, assets and ZIP export all work normally for this language.`;
      setOutput(info); setStdout(""); setStderr(""); setExitCode(null);
      setBottomTab("output");
      toast.message(`${spec.label} is snippet-only`, { description: "See the output panel for details." });
      return;
    }
    const isMobileNative = effectiveTrack === "mobile" && (state.language === "kotlin" || state.language === "swift" || state.language === "dart");
    const mobileNotice = isMobileNative
      ? `⚠️  Real Android emulator / iOS Simulator / Flutter device CANNOT run inside the browser.\n` +
        `    They require Android Studio, Xcode (macOS), or the Flutter SDK on your machine.\n\n` +
        `What the Mobile Playground does instead for ${spec.label}:\n` +
        `  • Compiles & runs your code as a console snippet via a free public runner (Judge0 / Piston).\n` +
        `  • Validates syntax, shows stdout/stderr, runtime and memory.\n` +
        `  • AI assistant: Explain, Convert, Generate tests, Document.\n` +
        `  • Export → packages a ready-to-open Android Gradle / Xcode / Flutter project ZIP.\n\n` +
        `Attempting snippet execution…\n` + `─────────────────────────────────\n`
      : "";
    setRunning(true); setOutput(mobileNotice + "Running…"); setStdout(""); setStderr(""); setExitCode(null); setLastRun(null);
    setBottomTab("output");
    try {
      const r = await runCode(state.language, activeFile.content, "", "judge0", {
        fallback: true,
        onFallback: (info) => toast.warning(`${PROVIDERS[info.from].label} → ${PROVIDERS[info.to].label}`, { description: info.reason }),
      });
      setOutput(mobileNotice + (r.output || "(no output)")); setStdout(r.stdout); setStderr(r.stderr); setExitCode(r.code);
      setLastRun({ provider: PROVIDERS[r.provider].label, timeSec: r.timeSec, memoryKb: r.memoryKb, status: r.status });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const hint = isMobileNative
        ? `\n\nTip: Tap the Export button (download icon) to download a ready-to-run ${state.language === "kotlin" ? "Android Studio" : state.language === "swift" ? "Xcode" : "Flutter"} project, then run it locally.`
        : "";
      setOutput(mobileNotice + `Error: ${msg}${hint}`); setStderr(msg);
      toast.error("Run failed", { description: msg });
    } finally { setRunning(false); }
  }

  function handleShare() {
    try {
      const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
        v: 2,
        state,
        previewStorage: persistPreviewStorage ? previewStorage : { local: {}, session: {} },
        persistPreviewStorage,
      }))));
      const url = `${location.origin}${location.pathname}#share=${payload}`;
      navigator.clipboard.writeText(url);
      toast.success("Share link copied", {
        description: persistPreviewStorage
          ? "Link includes preview data so the recipient sees the same state."
          : "Anyone with the link can open this project.",
      });
    } catch { toast.error("Could not create share link"); }
  }

  // Restore from share hash
  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.location.hash.match(/#share=(.+)/);
    if (!m) return;
    try {
      const json = decodeURIComponent(escape(atob(m[1])));
      const parsed = JSON.parse(json) as
        | IdeState
        | { v: 2; state: IdeState; previewStorage?: { local: Record<string,string>; session: Record<string,string> }; persistPreviewStorage?: boolean };
      const sharedState = "v" in parsed && parsed.v === 2 ? parsed.state : (parsed as IdeState);
      if (sharedState.files?.length) {
        setState(ensureActive(sharedState));
        if ("v" in parsed && parsed.v === 2) {
          if (typeof parsed.persistPreviewStorage === "boolean") setPersistPreviewStorage(parsed.persistPreviewStorage);
          if (parsed.previewStorage) setPreviewStorage(parsed.previewStorage);
        }
        toast.success("Loaded shared project");
      }
      window.history.replaceState(null, "", window.location.pathname);
    } catch { /* ignore */ }
  }, []);
  async function handleRunSmokeTest(opts?: { onlyFailed?: boolean; platform?: "all" | "web" | "mobile" }) {
    if (smokeRunning) return;
    const platform = opts?.platform ?? smokePlatformFilter;
    setSmokeRunning(true);
    setSmokeProgress({ done: 0, total: 0, current: "" });
    try {
      const mod = await import("@/lib/playground/smoke-test");
      const onlyIds = opts?.onlyFailed && smokeResults
        ? smokeResults.filter((r) => !r.ok).map((r) => r.id)
        : undefined;
      if (opts?.onlyFailed && (!onlyIds || onlyIds.length === 0)) {
        toast.info("Nothing to retry — no failed templates");
        setSmokeRunning(false);
        return;
      }
      const platforms = platform === "all" ? undefined : [platform];
      const results = await mod.runSmokeTest({
        onlyIds, platforms,
        onProgress: (done, total, current) => setSmokeProgress({ done, total, current }),
      });
      // Preserve previous run for diff; merge when retrying only failed.
      setSmokePrevResults(smokeResults);
      const merged = opts?.onlyFailed && smokeResults ? mod.mergeResults(smokeResults, results) : results;
      setSmokeResults(merged);
      setSmokeRanAt(Date.now());
      const failed = results.filter((r) => !r.ok);
      if (failed.length === 0) toast.success(`All ${results.length} templates passed`);
      else toast.error(`${failed.length} of ${results.length} templates have errors`, {
        description: failed.slice(0, 3).map((r) => r.name).join(", ") + (failed.length > 3 ? "…" : ""),
      });
    } catch (e) {
      toast.error("Smoke test failed", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSmokeRunning(false);
    }
  }


  // --------- Editor ---------
  const onMount = useCallback<OnMount>((ed, mn) => {
    editorRef.current = ed; monacoRef.current = mn;
    registerEditorThemes(mn);
    // Cmd/Ctrl+S = save (autosave already runs; format first when enabled).
    ed.addCommand(mn.KeyMod.CtrlCmd | mn.KeyCode.KeyS, async () => {
      const { getFormatOnSave } = await import("@/lib/playground/format");
      if (getFormatOnSave()) await formatDocument(true);
      toast.success("Saved");
    });
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
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-2 sm:px-3"
          style={{ borderColor: palette.border, background: palette.panel }}>
          <button onClick={() => setFilesOpen(true)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
            style={{ background: "linear-gradient(160deg,#4f8cff,#7e5bff)", color: "#fff" }}
            title="Files">
            <FolderOpen size={16} />
          </button>
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <Input
              value={state.projectName}
              onChange={(e) => setState((s) => ({ ...s, projectName: e.target.value }))}
              className="h-7 w-full min-w-0 border-0 bg-transparent px-0 text-sm font-semibold focus-visible:ring-0"
              style={{ color: palette.text }}
            />
            <span className="flex items-center gap-1.5 truncate text-[10px]" style={{ color: palette.subtle }}>
              {state.kind === "web"
                ? <>HTML · CSS · JS</>
                : <><LanguageIcon language={state.language} size={11} /> {LANGUAGES[state.language].label}</>}
              {savedAt && <SavedPill at={savedAt} />}
            </span>
          </div>


          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
            <Button size="icon" variant="ghost" onClick={() => setTemplatesOpen(true)} title="Templates" className="h-9 w-9">
              <LayoutGrid size={16} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setApiOpen(true)} title="API Tester" className="h-9 w-9">
              <Globe size={16} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setDbOpen(true)} title="Database" className="h-9 w-9">
              <DbIcon size={16} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setAssetsOpen(true)} title="Asset Manager" className="hidden h-9 w-9 sm:inline-flex">
              <Images size={16} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setGraphOpen(true)} title="Dependency Graph" className="hidden h-9 w-9 sm:inline-flex">
              <GitFork size={16} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setValidateOpen(true)}
              title={projectGraph.broken.length ? `Validate (${projectGraph.broken.length} issue${projectGraph.broken.length === 1 ? "" : "s"})` : "Validate project"}
              className="relative h-9 w-9">
              <ShieldCheck size={16} />
              {projectGraph.broken.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-3.5 min-w-[14px] place-items-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-black">
                  {projectGraph.broken.length}
                </span>
              )}
            </Button>
            <Button size="icon" variant="ghost" onClick={exportZip} title="Download as ZIP" className="h-9 w-9">
              <Download size={16} />
            </Button>
            {effectiveTrack === "mobile" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" title="Export native project (Android / iOS / Flutter)" className="h-9 w-9">
                    <Smartphone size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="text-xs">Export to local IDE</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => exportNative("android")}>
                    <Smartphone size={14} className="mr-2" />
                    <div className="flex flex-col">
                      <span className="text-sm">Android (Gradle · Kotlin)</span>
                      <span className="text-[10px] opacity-70">Open in Android Studio</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => exportNative("ios")}>
                    <Smartphone size={14} className="mr-2" />
                    <div className="flex flex-col">
                      <span className="text-sm">iOS (Xcode · SwiftUI)</span>
                      <span className="text-[10px] opacity-70">Open in Xcode on macOS</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => exportNative("flutter")}>
                    <Smartphone size={14} className="mr-2" />
                    <div className="flex flex-col">
                      <span className="text-sm">Flutter (Dart)</span>
                      <span className="text-[10px] opacity-70">flutter run on any device</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled className="opacity-60">
                    <span className="text-[10px]">Browser sandboxes can't run real emulators.</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button size="icon" variant="ghost" onClick={handleShare} title="Share" className="hidden h-9 w-9 sm:inline-flex">
              <Share2 size={16} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setCmdOpen(true)} title="Command Palette (⌘K)" className="hidden h-9 w-9 sm:inline-flex">
              <CommandIcon size={16} />
            </Button>
            <Button size="icon" variant="ghost" onClick={openFindReplace} title="Find & Replace" className="hidden h-9 w-9 sm:inline-flex">
              <ReplaceIcon size={16} />
            </Button>
            <Button size="icon" variant="ghost" onClick={toggleAppTheme} title={`Theme: ${APP_THEMES[appTheme].label}`} className="h-9 w-9">
              {appTheme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setAiOpen(true)} title="AI Assistant" className="h-9 w-9">
              <Sparkles size={16} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setSettingsOpen(true)} title="Settings" className="h-9 w-9">
              <SettingsIcon size={16} />
            </Button>
            <Button size="sm" onClick={handleRun} disabled={running}
              className="ml-1 h-9 rounded-xl px-3 sm:px-4"
              style={{ background: "linear-gradient(160deg,#5fd38a,#4f8cff)", color: "#001028" }}>
              {running ? <Loader2 className="animate-spin sm:mr-1" size={14} /> : <Play size={14} className="sm:mr-1" />}
              <span className="hidden sm:inline">Run</span>
            </Button>
          </div>
        </header>
      )}

      {/* Tab strip */}
      {!fullscreen && (
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b px-2 py-1"
          style={{ borderColor: palette.border, background: palette.panel }}>
          {state.files.filter((f) => !f.asset).map((f) => (
            <button key={f.id}
              onClick={() => setState((s) => ({ ...s, activeFileId: f.id }))}
              className={`group inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                f.id === state.activeFileId ? "" : "opacity-60 hover:opacity-100"
              }`}
              style={{
                background: f.id === state.activeFileId ? palette.bg : "transparent",
                color: palette.text,
                border: `1px solid ${f.id === state.activeFileId ? palette.border : "transparent"}`,
              }}
              title={f.path}>
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

      {/* Breadcrumb */}
      {!fullscreen && activeFile && (
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b px-3 py-1 text-[11px]"
          style={{ borderColor: palette.border, background: palette.bg, color: palette.subtle }}>
          {activeFile.path.split("/").map((seg, i, arr) => (
            <span key={i} className="inline-flex items-center gap-1">
              {i > 0 && <ChevronRight size={10} />}
              <span className={i === arr.length - 1 ? "font-medium" : ""} style={i === arr.length - 1 ? { color: palette.text } : undefined}>{seg}</span>
            </span>
          ))}
          <Button size="sm" variant="ghost" onClick={() => formatDocument()} className="ml-auto h-6 px-2 text-[10px]" title="Format document (Shift+Alt+F)">
            <Wand2 size={11} className="mr-1" /> Format
          </Button>
        </div>
      )}

      {/* Editor + bottom/side panel */}
      {(() => {
        const showPanel = !fullscreen;
        const canPreview = state.kind === "web" || effectiveTrack === "mobile";
        const isSplit = showPanel && layoutMode === "split" && canPreview;
        const isMax = previewMax && canPreview && !fullscreen;

        const editorPane = (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col" style={{ background: palette.bg }}>
            <div className="min-h-0 flex-1" style={{ background: palette.bg }}>
              {activeFile?.asset ? (
                <AssetPreview file={activeFile} palette={palette} />
              ) : (
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
              )}
            </div>
            {showPanel && (
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
                {canPreview && (
                  <button onClick={() => setLayoutMode((m) => m === "stacked" ? "split" : "stacked")}
                    className="h-8 shrink-0 rounded-lg px-2 text-xs"
                    style={{ background: palette.bg, color: palette.text, border: `1px solid ${palette.border}` }}
                    title={layoutMode === "stacked" ? "Side-by-side split view" : "Stacked layout"}>
                    <LayoutGrid size={12} />
                  </button>
                )}
                <button onClick={() => setFullscreen(true)}
                  className="h-8 shrink-0 rounded-lg px-2 text-xs"
                  style={{ background: palette.bg, color: palette.text, border: `1px solid ${palette.border}` }}
                  title="Fullscreen editor"><Maximize2 size={12} /></button>
              </div>
            )}
          </div>
        );

        const panelHeader = (
          <div className="flex items-center gap-1 border-b px-2 py-1" style={{ borderColor: palette.border }}>
            {canPreview && (
              <TabBtn active={bottomTab === "preview"} onClick={() => setBottomTab("preview")} palette={palette}>
                <Smartphone size={12} className="mr-1" /> Preview
              </TabBtn>
            )}
            <TabBtn active={bottomTab === "console"} onClick={() => setBottomTab("console")} palette={palette}>
              <Terminal size={12} className="mr-1" /> Console {consoleMsgs.length > 0 && <span className="ml-1 text-[10px] opacity-70">{consoleMsgs.length}</span>}
            </TabBtn>
            {(() => {
              const errCount = consoleMsgs.filter((m) => m.level === "error" || m.level === "warn").length;
              return (
                <TabBtn active={bottomTab === "errors"} onClick={() => setBottomTab("errors")} palette={palette}>
                  <Terminal size={12} className="mr-1" /> Errors {errCount > 0 && <span className="ml-1 rounded px-1 text-[10px]" style={{ background: "#ff6f8a22", color: "#ff6f8a" }}>{errCount}</span>}
                </TabBtn>
              );
            })()}
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
                      className="grid h-7 min-w-[28px] place-items-center rounded-md px-1.5 text-[10px] font-medium"
                      style={{ background: viewport === v ? palette.bg : "transparent", color: palette.text, border: `1px solid ${viewport === v ? palette.border : "transparent"}` }}
                      title={PREVIEW_VIEWPORTS[v].label}>
                      {v === "fit" ? "Fit" : v === "mobile" ? <Smartphone size={12} /> : v === "tablet" ? <Tablet size={12} /> : <Monitor size={12} />}
                    </button>
                  ))}
                  <button onClick={() => setState((s) => ({ ...s }))}
                    className="grid h-7 w-7 place-items-center rounded-md hover:bg-white/10" title="Reload preview">
                    <RefreshCw size={12} />
                  </button>
                  <button
                    onClick={() => {
                      setLayoutMode("split");
                      setViewport("fit");
                      setPreviewMax(false);
                      setPanelHeight(320);
                      setSplitWidth(50);
                      toast.success("Preview layout reset");
                    }}
                    className="inline-flex h-7 items-center rounded-md px-2 text-[10px] font-medium hover:bg-white/10"
                    title="Reset to default split + Fit layout">
                    Reset
                  </button>
                  <button
                    onClick={() => setPersistPreviewStorage((v) => !v)}
                    className="inline-flex h-7 items-center rounded-md px-2 text-[10px] font-medium hover:bg-white/10"
                    title={persistPreviewStorage
                      ? "Preview localStorage/sessionStorage is being persisted across reloads. Click to disable."
                      : "Preview localStorage/sessionStorage resets on every reload. Click to persist."}>
                    <span className="mr-1 h-1.5 w-1.5 rounded-full" style={{ background: persistPreviewStorage ? "#39d98a" : "#888" }} />
                    Persist
                  </button>
                  {persistPreviewStorage && (Object.keys(previewStorage.local).length > 0 || Object.keys(previewStorage.session).length > 0) && (
                    <button
                      onClick={() => {
                        setPreviewStorage({ local: {}, session: {} });
                        try { localStorage.removeItem(storageStorageKey); } catch { /* noop */ }
                        setState((s) => ({ ...s }));
                        toast.success("Preview storage cleared");
                      }}
                      className="inline-flex h-7 items-center rounded-md px-2 text-[10px] font-medium hover:bg-white/10"
                      title="Clear the persisted preview localStorage/sessionStorage snapshot">
                      Clear data
                    </button>
                  )}
                </>
              )}
              {bottomTab === "errors" && (
                <button onClick={() => setConsoleMsgs((p) => p.filter((m) => m.level !== "error" && m.level !== "warn"))}
                  className="inline-flex h-7 items-center rounded-md px-2 text-[11px] hover:bg-white/10">
                  <Eraser size={12} className="mr-1" /> Clear errors
                </button>
              )}
              
              {bottomTab === "preview" && canPreview && (
                <button onClick={() => setPreviewMax((v) => !v)}
                  className="grid h-7 w-7 place-items-center rounded-md hover:bg-white/10"
                  title={previewMax ? "Exit preview fullscreen" : "Preview fullscreen"}>
                  {previewMax ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                </button>
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
        );

        const panelBody = (
          <div className="min-h-0 min-w-0 flex-1 overflow-auto">
            {bottomTab === "preview" && canPreview && (
              <div className="flex h-full flex-col">
                {effectiveTrack === "mobile" && (
                  <div className="shrink-0 border-b px-3 py-2 text-[11px] leading-relaxed" style={{ borderColor: palette.border, background: palette.panel, color: palette.subtle }}>
                    <div className="mb-1"><span className="font-semibold" style={{ color: palette.text }}>Why no live emulator?</span> Real Android emulators and the iOS Simulator can't run inside a browser sandbox — they need virtualization, native toolchains and (for iOS) macOS.</div>
                    <div><span className="font-semibold" style={{ color: palette.text }}>To run as a real app:</span> tap the <Smartphone size={11} className="inline -mt-0.5" /> Export button → choose Android Studio, Xcode, or Flutter.</div>
                  </div>
                )}
                <div className="min-h-0 flex-1">
                  <PreviewFrame doc={previewDoc} viewport={viewport} bg={palette.bg} />
                </div>
              </div>
            )}
            {bottomTab === "console" && (
              <ConsolePanel msgs={consoleMsgs} subtle={palette.subtle} />
            )}
            {bottomTab === "errors" && (
              <ErrorsPanel
                msgs={consoleMsgs.filter((m) => m.level === "error" || m.level === "warn")}
                subtle={palette.subtle}
                palette={palette}
              />
            )}
            {bottomTab === "output" && (
              <div className="flex h-full flex-col">
                {lastRun && (
                  <div className="shrink-0 border-b px-3 py-1.5 text-[11px]" style={{ borderColor: palette.border, background: palette.panel, color: palette.subtle }}>
                    <span className="font-semibold" style={{ color: palette.text }}>{lastRun.provider}</span>
                    {lastRun.status && <span className="ml-2">· {lastRun.status}</span>}
                    {lastRun.timeSec != null && <span className="ml-2">· {lastRun.timeSec.toFixed(3)}s</span>}
                    {lastRun.memoryKb != null && <span className="ml-2">· {(lastRun.memoryKb / 1024).toFixed(1)} MB</span>}
                    {exitCode !== null && <span className="ml-2">· exit {exitCode}</span>}
                  </div>
                )}
                <pre className="m-0 min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed"
                  style={{ background: "#000", color: "#7ce38b" }}>
                  {output || "Tap Run to execute your code."}
                </pre>
              </div>
            )}
          </div>
        );

        if (isMax) {
          return (
            <div className="flex min-h-0 flex-1 flex-col border-t" style={{ borderColor: palette.border, background: palette.panel }}>
              {panelHeader}
              {panelBody}
            </div>
          );
        }

        if (isSplit) {
          return (
            <div className="flex min-h-0 flex-1 flex-row">
              <div className="flex min-w-0 flex-col" style={{ width: `${100 - splitWidth}%` }}>
                {editorPane}
              </div>
              <DragHandle
                orientation="vertical"
                onDelta={(_dy, dx, parentSize) => {
                  if (!parentSize) return;
                  const next = splitWidth - (dx / parentSize) * 100;
                  setSplitWidth(Math.max(20, Math.min(80, next)));
                }}
                color={palette.border}
              />
              <div className="flex min-w-0 flex-col border-l" style={{ width: `${splitWidth}%`, borderColor: palette.border, background: palette.panel }}>
                {panelHeader}
                {panelBody}
              </div>
            </div>
          );
        }

        return (
          <div className="flex min-h-0 flex-1 flex-col">
            {editorPane}
            {showPanel && (
              <>
                <DragHandle
                  orientation="horizontal"
                  onDelta={(dy, _dx, parentSize) => {
                    if (!parentSize) return;
                    const next = panelHeight - dy;
                    setPanelHeight(Math.max(120, Math.min(parentSize - 160, next)));
                  }}
                  color={palette.border}
                />
                <div className="flex shrink-0 flex-col border-t"
                  style={{ borderColor: palette.border, background: palette.panel, height: panelHeight }}>
                  {panelHeader}
                  {panelBody}
                </div>
              </>
            )}
          </div>
        );
      })()}


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
        <SheetContent side="left" className="w-[340px] p-0" style={{ background: palette.panel, color: palette.text, borderColor: palette.border }}>
          <SheetHeader className="border-b px-4 py-3" style={{ borderColor: palette.border }}>
            <SheetTitle style={{ color: palette.text }}>Files</SheetTitle>
          </SheetHeader>
          <FilesTree
            files={state.files}
            folders={state.folders ?? []}
            activeFileId={state.activeFileId}
            palette={palette}
            onOpen={(id) => { setState((s) => ({ ...s, activeFileId: id })); setFilesOpen(false); }}
            onAddFile={addFile}
            onAddFolder={addFolder}
            onDeleteFile={deleteFile}
            onDeleteFolder={deleteFolder}
            onRenameFile={renameFile}
            onUploadAssets={uploadAssets}
            uploads={uploads}
            onClearUploads={clearUploads}
            onOpenTemplates={() => setTemplatesOpen(true)}
          />
        </SheetContent>
      </Sheet>

      {/* Templates sheet */}
      <Sheet open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <SheetContent side="bottom" className="h-[90vh] sm:h-[80vh] p-0" style={{ background: palette.panel, color: palette.text, borderColor: palette.border }}>
          <SheetHeader className="border-b px-3 py-3 sm:px-4" style={{ borderColor: palette.border }}>
            <div className="flex flex-wrap items-center gap-2">
              <SheetTitle className="flex-1 min-w-0 truncate text-sm sm:text-base" style={{ color: palette.text }}>
                Start from a {effectiveTrack === "code" ? "Code" : effectiveTrack === "mobile" ? "Mobile" : "Web"} template
              </SheetTitle>
              <button type="button" onClick={() => handleRunSmokeTest()} disabled={smokeRunning}
                className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md border px-3 text-xs font-medium disabled:opacity-60"
                style={{ borderColor: palette.border, color: palette.text }}
                title="Load every template in a hidden iframe and report runtime errors / missing assets">
                {smokeRunning
                  ? <><Loader2 size={12} className="animate-spin" /> Testing {smokeProgress.done}/{smokeProgress.total}</>
                  : <><ShieldCheck size={12} /> Smoke test</>}
              </button>
              <label className="inline-flex shrink-0">
                <input type="file" accept=".zip,application/zip" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) importZip(f); e.target.value = ""; }} />
                <span className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border px-3 text-xs font-medium"
                  style={{ borderColor: palette.border, color: palette.text }}>
                  <Upload size={12} /> Import ZIP
                </span>
              </label>
            </div>
          </SheetHeader>
          <div className="h-[calc(90vh-56px)] sm:h-[calc(80vh-56px)] overflow-auto p-3">
            {smokeRunning && (
              <div className="mb-3 rounded-md border p-2 text-xs" style={{ borderColor: palette.border, color: palette.subtle }}>
                Running… {smokeProgress.current}
              </div>
            )}
            {smokeResults && !smokeRunning && (() => {
              const mod = require("@/lib/playground/smoke-test") as typeof import("@/lib/playground/smoke-test");
              const summary = mod.summarize(smokeResults, smokeRanAt);
              const diff = mod.diffRuns(smokePrevResults, smokeResults);
              const filtered = smokePlatformFilter === "all"
                ? smokeResults
                : smokeResults.filter((r) => r.platform === smokePlatformFilter);
              const failedCount = smokeResults.filter((r) => !r.ok).length;
              const fmtTime = (t: number | null) => t ? new Date(t).toLocaleTimeString() : "—";
              return (
                <div className="mb-4 rounded-md border" style={{ borderColor: palette.border }}>
                  {/* Compact summary */}
                  <div className="border-b px-3 py-2 text-xs" style={{ borderColor: palette.border }}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold" style={{ color: palette.text }}>
                        Smoke test · {summary.passed}/{summary.total} passed ({Math.round(summary.passRate * 100)}%)
                      </span>
                      <div className="flex items-center gap-2">
                        <span style={{ color: palette.subtle }}>Last run {fmtTime(summary.lastRunAt)}</span>
                        <button onClick={() => { setSmokeResults(null); setSmokePrevResults(null); setSmokeRanAt(null); }}
                          className="opacity-60 hover:opacity-100" style={{ color: palette.text }}>
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded px-2 py-0.5" style={{ background: palette.bg, color: palette.text, border: `1px solid ${palette.border}` }}>
                        Web {summary.byPlatform.web.passed}/{summary.byPlatform.web.total}
                        {summary.byPlatform.web.failed > 0 && <span className="ml-1" style={{ color: "#ef4444" }}>· {summary.byPlatform.web.failed} fail</span>}
                      </span>
                      <span className="rounded px-2 py-0.5" style={{ background: palette.bg, color: palette.text, border: `1px solid ${palette.border}` }}>
                        Mobile {summary.byPlatform.mobile.passed}/{summary.byPlatform.mobile.total}
                        {summary.byPlatform.mobile.failed > 0 && <span className="ml-1" style={{ color: "#ef4444" }}>· {summary.byPlatform.mobile.failed} fail</span>}
                      </span>
                      {summary.topCategories.length > 0 && (
                        <span style={{ color: palette.subtle }}>
                          Top: {summary.topCategories.map((c) => `${c.category} (${c.count})`).join(" · ")}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {(["all", "web", "mobile"] as const).map((p) => (
                        <button key={p} onClick={() => setSmokePlatformFilter(p)}
                          className="rounded px-2 py-0.5 text-[10px] uppercase tracking-wider"
                          style={{
                            background: smokePlatformFilter === p ? palette.text : "transparent",
                            color: smokePlatformFilter === p ? palette.bg : palette.subtle,
                            border: `1px solid ${palette.border}`,
                          }}>
                          {p}
                        </button>
                      ))}
                      <button onClick={() => handleRunSmokeTest({ onlyFailed: true })}
                        disabled={failedCount === 0}
                        className="ml-auto rounded px-2 py-0.5 text-[10px] font-medium disabled:opacity-40"
                        style={{ border: `1px solid ${palette.border}`, color: palette.text }}>
                        <RefreshCw size={10} className="mr-1 inline" />
                        Retry failed ({failedCount})
                      </button>
                      <button onClick={() => handleRunSmokeTest()}
                        className="rounded px-2 py-0.5 text-[10px] font-medium"
                        style={{ border: `1px solid ${palette.border}`, color: palette.text }}>
                        Rerun all
                      </button>
                    </div>
                  </div>

                  {/* Diff vs previous run */}
                  {smokePrevResults && diff.changed.length > 0 && (
                    <div className="border-b px-3 py-2 text-[11px]" style={{ borderColor: palette.border }}>
                      <div className="mb-1 font-semibold" style={{ color: palette.text }}>
                        Changes vs previous run · {diff.regressed.length} regressed · {diff.recovered.length} recovered
                      </div>
                      <ul className="space-y-1">
                        {diff.changed.slice(0, 8).map((d) => (
                          <li key={d.id} className="flex flex-wrap items-start gap-x-2">
                            <span style={{
                              color: d.status === "regressed" ? "#ef4444"
                                : d.status === "recovered" ? "#39d98a"
                                : palette.subtle,
                            }}>
                              {d.status === "regressed" ? "↓" : d.status === "recovered" ? "↑" : "•"}
                            </span>
                            <span style={{ color: palette.text }}>{d.name}</span>
                            <span className="text-[10px] uppercase opacity-60" style={{ color: palette.subtle }}>{d.platform}</span>
                            <span className="text-[10px]" style={{ color: palette.subtle }}>{d.status}</span>
                            {d.newErrors.length > 0 && (
                              <span className="basis-full pl-4" style={{ color: "#fca5a5" }}>
                                + {d.newErrors.slice(0, 2).join(" | ")}
                              </span>
                            )}
                            {d.newAssetFailures.length > 0 && (
                              <span className="basis-full pl-4" style={{ color: "#fdba74" }}>
                                + asset: {d.newAssetFailures.slice(0, 2).join(" | ")}
                              </span>
                            )}
                            {d.fixedErrors.length > 0 && (
                              <span className="basis-full pl-4" style={{ color: "#86efac" }}>
                                − {d.fixedErrors.slice(0, 2).join(" | ")}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Per-template results */}
                  <ul className="max-h-56 divide-y overflow-auto text-[11px]" style={{ borderColor: palette.border }}>
                    {filtered.map((r) => (
                      <li key={r.id} className="px-3 py-1.5">
                        <div className="flex items-center justify-between">
                          <span style={{ color: palette.text }}>
                            <span className="mr-2" style={{ color: r.ok ? "#39d98a" : "#ef4444" }}>{r.ok ? "✓" : "✗"}</span>
                            {r.name}
                            <span className="ml-2 text-[10px] uppercase opacity-60" style={{ color: palette.subtle }}>
                              {r.platform}{r.staticOnly ? " · static" : ""}
                            </span>
                          </span>
                          <span style={{ color: palette.subtle }}>
                            {r.errors.length > 0 && <span className="mr-2" style={{ color: "#ef4444" }}>{r.errors.length} err</span>}
                            {r.assetFailures.length > 0 && <span className="mr-2" style={{ color: "#fdba74" }}>{r.assetFailures.length} 404</span>}
                            {r.warnings.length > 0 && <span className="mr-2" style={{ color: "#f59e0b" }}>{r.warnings.length} warn</span>}
                            {r.recovered.length > 0 && <span style={{ color: "#39d98a" }}>{r.recovered.length} auto-fix</span>}
                          </span>
                        </div>
                        {r.errors.length > 0 && (
                          <ul className="mt-1 ml-5 list-disc space-y-0.5 break-words" style={{ color: "#fca5a5" }}>
                            {r.errors.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
                          </ul>
                        )}
                        {r.assetFailures.length > 0 && (
                          <ul className="mt-1 ml-5 list-disc space-y-0.5 break-words" style={{ color: "#fdba74" }}>
                            {r.assetFailures.slice(0, 2).map((e, i) => <li key={i}>{e}</li>)}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            {MULTI_TEMPLATES.filter((t) => t.tracks.includes(effectiveTrack)).length > 0 && (
              <>
                <div className="mb-2 mt-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: palette.subtle }}>
                  Multi-file projects
                </div>
                <div className="mb-4 grid grid-cols-1 gap-2 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                  {MULTI_TEMPLATES.filter((t) => t.tracks.includes(effectiveTrack)).map((t) => (
                    <button key={t.id} onClick={() => loadMultiTemplate(t)}
                      className="flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition hover:-translate-y-0.5"
                      style={{ borderColor: palette.border, background: palette.bg }}>
                      <TemplateIcon name={t.icon} size={24} />
                      <span className="text-sm font-semibold">{t.name}</span>
                      <span className="line-clamp-2 text-[11px]" style={{ color: palette.subtle }}>{t.description}</span>
                      <span className="text-[10px] opacity-60">{t.files.length} files · {t.folders.length} folders</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: palette.subtle }}>
              Single-file templates
            </div>
            <div className="grid grid-cols-1 gap-2 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">

              {effectiveTrack !== "code" && (
                <button onClick={() => newBlank("web")}
                  className="flex flex-col items-start gap-2 rounded-xl border p-3 text-left"
                  style={{ borderColor: palette.border, background: palette.bg }}>
                  <TemplateIcon name="blank-web" size={24} />
                  <span className="text-sm font-semibold">Blank Web</span>
                  <span className="text-[11px]" style={{ color: palette.subtle }}>HTML + CSS + JS</span>
                </button>
              )}
              {effectiveTrack === "code" && (
                <button onClick={() => newBlank("code")}
                  className="flex flex-col items-start gap-2 rounded-xl border p-3 text-left"
                  style={{ borderColor: palette.border, background: palette.bg }}>
                  <TemplateIcon name="blank-code" size={24} />
                  <span className="text-sm font-semibold">Blank Script</span>
                  <span className="text-[11px]" style={{ color: palette.subtle }}>Pick any language</span>
                </button>
              )}
              {trackTemplates.map((t) => (
                <button key={t.id} onClick={() => loadTemplate(t)}
                  className="flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition hover:-translate-y-0.5"
                  style={{ borderColor: palette.border, background: palette.bg }}>
                  <TemplateIcon name={t.icon} size={24} />
                  <span className="text-sm font-semibold">{t.name}</span>
                  <span className="line-clamp-2 text-[11px]" style={{ color: palette.subtle }}>{t.description}</span>
                </button>
              ))}
            </div>
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

      {/* API Tester sheet */}
      <Sheet open={apiOpen} onOpenChange={setApiOpen}>
        <SheetContent side="bottom" className="h-[85vh] p-0" style={{ background: palette.panel, color: palette.text, borderColor: palette.border }}>
          <SheetHeader className="border-b px-4 py-3" style={{ borderColor: palette.border }}>
            <SheetTitle style={{ color: palette.text }}><Globe size={14} className="mr-1 inline" /> API Tester</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(85vh-3.5rem)]"><ApiTester /></div>
        </SheetContent>
      </Sheet>

      {/* Database sheet */}
      <Sheet open={dbOpen} onOpenChange={setDbOpen}>
        <SheetContent side="bottom" className="h-[85vh] p-0" style={{ background: palette.panel, color: palette.text, borderColor: palette.border }}>
          <SheetHeader className="border-b px-4 py-3" style={{ borderColor: palette.border }}>
            <SheetTitle style={{ color: palette.text }}><DbIcon size={14} className="mr-1 inline" /> Database</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(85vh-3.5rem)]"><DbConsole storageKey={`${storageKey}:db`} /></div>
        </SheetContent>
      </Sheet>

      {/* Asset Manager sheet */}
      <Sheet open={assetsOpen} onOpenChange={setAssetsOpen}>
        <SheetContent side="bottom" className="h-[85vh] p-0" style={{ background: palette.panel, color: palette.text, borderColor: palette.border }}>
          <SheetHeader className="border-b px-4 py-3" style={{ borderColor: palette.border }}>
            <SheetTitle style={{ color: palette.text }}><Images size={14} className="mr-1 inline" /> Assets</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(85vh-3.5rem)]">
            <AssetManager
              files={state.files}
              palette={palette}
              onUpload={(fl) => uploadAssets(fl)}
              onDelete={(id) => deleteFile(id)}
              onInsertPath={(p) => {
                const ed = editorRef.current;
                if (!ed) { navigator.clipboard.writeText(p).catch(() => {}); return; }
                ed.focus();
                const sel = ed.getSelection();
                if (!sel) return;
                ed.executeEdits("insert-asset", [{ range: sel, text: p, forceMoveMarkers: true }]);
                setAssetsOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Dependency Graph sheet */}
      <Sheet open={graphOpen} onOpenChange={setGraphOpen}>
        <SheetContent side="bottom" className="h-[70vh] p-0" style={{ background: palette.panel, color: palette.text, borderColor: palette.border }}>
          <SheetHeader className="border-b px-4 py-3" style={{ borderColor: palette.border }}>
            <SheetTitle style={{ color: palette.text }}><GitFork size={14} className="mr-1 inline" /> Project dependency graph</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(70vh-3.5rem)]">
            <DepGraph graph={projectGraph} palette={palette}
              onSelect={(p) => {
                const hit = state.files.find((f) => f.path === p);
                if (hit) { setState((s) => ({ ...s, activeFileId: hit.id })); setGraphOpen(false); }
              }} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Validation report sheet */}
      <Sheet open={validateOpen} onOpenChange={setValidateOpen}>
        <SheetContent side="right" className="w-full max-w-md p-0 sm:w-[420px]" style={{ background: palette.panel, color: palette.text, borderColor: palette.border }}>
          <SheetHeader className="border-b px-4 py-3" style={{ borderColor: palette.border }}>
            <SheetTitle style={{ color: palette.text }}><ShieldCheck size={14} className="mr-1 inline" /> Project validation</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100vh-3.5rem)]">
            <ValidationReport graph={projectGraph} palette={palette}
              onOpenFile={(p) => {
                const hit = state.files.find((f) => f.path === p);
                if (hit) { setState((s) => ({ ...s, activeFileId: hit.id })); setValidateOpen(false); }
              }} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Command palette */}
      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Type a command or search files..." />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => { setCmdOpen(false); handleRun(); }}>
              <Play size={14} /> <span>Run code</span>
            </CommandItem>
            <CommandItem onSelect={() => { setCmdOpen(false); openFindReplace(); }}>
              <ReplaceIcon size={14} /> <span>Find &amp; Replace</span>
            </CommandItem>
            <CommandItem onSelect={() => { setCmdOpen(false); toggleAppTheme(); }}>
              {appTheme === "light" ? <Moon size={14} /> : <Sun size={14} />} <span>Toggle theme</span>
            </CommandItem>
            <CommandItem onSelect={() => { setCmdOpen(false); setTemplatesOpen(true); }}>
              <LayoutGrid size={14} /> <span>Browse templates</span>
            </CommandItem>
            <CommandItem onSelect={() => { setCmdOpen(false); setFilesOpen(true); }}>
              <FolderOpen size={14} /> <span>Open files</span>
            </CommandItem>
            <CommandItem onSelect={() => { setCmdOpen(false); setDbOpen(true); }}>
              <DbIcon size={14} /> <span>Open database console</span>
            </CommandItem>
            <CommandItem onSelect={() => { setCmdOpen(false); setAssetsOpen(true); }}>
              <Images size={14} /> <span>Open asset manager</span>
            </CommandItem>
            <CommandItem onSelect={() => { setCmdOpen(false); setGraphOpen(true); }}>
              <GitFork size={14} /> <span>Show dependency graph</span>
            </CommandItem>
            <CommandItem onSelect={() => { setCmdOpen(false); setValidateOpen(true); }}>
              <ShieldCheck size={14} /> <span>Validate project</span>
            </CommandItem>
            <CommandItem onSelect={() => { setCmdOpen(false); formatDocument(); }}>
              <Wand2 size={14} /> <span>Format document</span>
            </CommandItem>
            <CommandItem onSelect={() => { setCmdOpen(false); setApiOpen(true); }}>
              <Globe size={14} /> <span>Open API tester</span>
            </CommandItem>
            <CommandItem onSelect={() => { setCmdOpen(false); setAiOpen(true); }}>
              <Sparkles size={14} /> <span>Open AI assistant</span>
            </CommandItem>
            <CommandItem onSelect={() => { setCmdOpen(false); setSettingsOpen(true); }}>
              <SettingsIcon size={14} /> <span>Open settings</span>
            </CommandItem>
            <CommandItem onSelect={() => { setCmdOpen(false); exportZip(); }}>
              <Download size={14} /> <span>Download as ZIP</span>
            </CommandItem>
            <CommandItem onSelect={() => { setCmdOpen(false); handleShare(); }}>
              <Share2 size={14} /> <span>Share project</span>
            </CommandItem>
            <CommandItem onSelect={() => { setCmdOpen(false); setFullscreen((v) => !v); }}>
              {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />} <span>Toggle fullscreen</span>
            </CommandItem>
            <CommandItem onSelect={() => { setCmdOpen(false); copyAsMarkdown(); }}>
              <Copy size={14} /> <span>Copy project as Markdown</span>
            </CommandItem>
          </CommandGroup>
          {recentPaths.length > 0 && (
            <CommandGroup heading="Recent">
              {recentPaths
                .map((p) => state.files.find((f) => f.path === p))
                .filter((f): f is IdeFile => !!f && !f.asset)
                .map((f) => (
                  <CommandItem key={`recent-${f.id}`} value={`recent ${f.path}`} onSelect={() => { setCmdOpen(false); setState((s) => ({ ...s, activeFileId: f.id })); }}>
                    <FileText size={14} /> <span>{f.path}</span>
                  </CommandItem>
                ))}
            </CommandGroup>
          )}
          <CommandGroup heading="Files">
            {state.files.filter((f) => !f.asset).map((f) => (
              <CommandItem key={f.id} value={`file ${f.path}`} onSelect={() => { setCmdOpen(false); setState((s) => ({ ...s, activeFileId: f.id })); }}>
                <FileText size={14} /> <span>{f.path}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

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
                      <SelectItem key={k} value={k}>
                        <span className="inline-flex items-center gap-2"><LanguageIcon language={k} size={14} /> {LANGUAGES[k].label}</span>
                      </SelectItem>
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
            <SettingRow label="Format on save">
              <button onClick={async () => {
                const next = !formatOnSave;
                setFormatOnSaveState(next);
                const { setFormatOnSave } = await import("@/lib/playground/format");
                setFormatOnSave(next);
                toast.success(next ? "Format on save: ON" : "Format on save: OFF");
              }}
                className="inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm"
                style={{ borderColor: palette.border }}>
                <Wand2 size={14} className="mr-1" /> {formatOnSave ? "Enabled" : "Disabled"}
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
  return <FileExtIcon name={name} size={13} />;
}



function SavedPill({ at }: { at: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  const ageSec = Math.max(0, Math.round((now - at) / 1000));
  const label =
    ageSec < 5 ? "just now"
    : ageSec < 60 ? `${ageSec}s ago`
    : ageSec < 3600 ? `${Math.round(ageSec / 60)}m ago`
    : `${Math.round(ageSec / 3600)}h ago`;
  return <span className="opacity-70">· Saved {label}</span>;
}


function PreviewFrame({ doc, viewport, bg }: { doc: string; viewport: ViewportKey; bg: string }) {
  const v = PREVIEW_VIEWPORTS[viewport];
  const isFit = viewport === "fit";
  const [scale, setScale] = useState(1);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (isFit) { setScale(1); return; }
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
  }, [viewport, v.w, v.h, isFit]);

  if (isFit) {
    // Auto-fit: iframe fills the entire panel — no device frame, no scaling.
    return (
      <div ref={wrapRef} className="h-full w-full" style={{ background: "#fff" }}>
        <iframe title="preview" srcDoc={doc} sandbox="allow-scripts allow-forms allow-modals"
          style={{ width: "100%", height: "100%", border: 0, display: "block", background: "#fff" }} />
      </div>
    );
  }
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

function DragHandle({
  orientation, onDelta, color,
}: {
  orientation: "horizontal" | "vertical";
  /** (dy, dx, parentSize) — parentSize is height for horizontal, width for vertical. */
  onDelta: (dy: number, dx: number, parentSize: number) => void;
  color: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const start = useRef<{ x: number; y: number; parent: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const parentEl = ref.current?.parentElement;
    const parent = parentEl ? (orientation === "horizontal" ? parentEl.clientHeight : parentEl.clientWidth) : 0;
    start.current = { x: e.clientX, y: e.clientY, parent };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    onDelta(e.clientY - start.current.y, e.clientX - start.current.x, start.current.parent);
  };
  const onUp = (e: React.PointerEvent) => {
    start.current = null;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const isH = orientation === "horizontal";
  return (
    <div ref={ref}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      role="separator" aria-orientation={isH ? "horizontal" : "vertical"}
      className={isH ? "h-1.5 w-full cursor-row-resize hover:bg-white/10" : "w-1.5 h-full cursor-col-resize hover:bg-white/10"}
      style={{ background: color, touchAction: "none" }}
    />
  );
}


function ConsolePanel({ msgs, subtle, emptyText }: { msgs: ConsoleEntry[]; subtle: string; emptyText?: string }) {
  if (msgs.length === 0) return (
    <div className="grid h-full place-items-center p-4 text-center text-xs" style={{ color: subtle }}>
      {emptyText ?? "Console output from your preview will appear here."}
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

function ErrorsPanel({ msgs, subtle, palette }: { msgs: ConsoleEntry[]; subtle: string; palette: { bg: string; panel: string; border: string; text: string; subtle: string } }) {
  // Group identical error texts; surface the parsed source location (file:line:col)
  // already appended by the iframe bridge as "(preview:42:9)".
  const groups = useMemo(() => {
    const map = new Map<string, { level: string; text: string; location: string; count: number; lastId: number }>();
    for (const m of msgs) {
      const loc = /\(([^()]+:\d+(?::\d+)?)\)\s*$/.exec(m.text);
      const location = loc ? loc[1] : "";
      const text = loc ? m.text.slice(0, loc.index).trim() : m.text;
      const key = `${m.level}::${text}`;
      const g = map.get(key);
      if (g) { g.count += 1; g.lastId = m.id; if (location) g.location = location; }
      else map.set(key, { level: m.level, text, location, count: 1, lastId: m.id });
    }
    return Array.from(map.values()).sort((a, b) => b.lastId - a.lastId);
  }, [msgs]);

  if (groups.length === 0) return (
    <div className="grid h-full place-items-center p-4 text-center text-xs" style={{ color: subtle }}>
      No runtime errors or warnings from the Live Preview. 🎉
    </div>
  );
  const color: Record<string, string> = { error: "#ff6f8a", warn: "#ffb86c" };
  return (
    <div className="h-full overflow-auto p-2 font-mono text-[11px] leading-relaxed">
      {groups.map((g, i) => (
        <div key={i} className="mb-1 flex items-start gap-2 rounded-md border px-2 py-1.5"
          style={{ borderColor: palette.border, background: palette.bg }}>
          <span className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
            style={{ background: `${color[g.level] ?? color.error}22`, color: color[g.level] ?? color.error }}>
            {g.level}
          </span>
          <div className="min-w-0 flex-1">
            <div className="break-words" style={{ color: palette.text }}>{g.text}</div>
            {g.location && (
              <div className="mt-0.5 text-[10px]" style={{ color: subtle }}>
                at <span className="font-semibold">{g.location}</span>
              </div>
            )}
          </div>
          {g.count > 1 && (
            <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: `${color[g.level] ?? color.error}22`, color: color[g.level] ?? color.error }}>
              ×{g.count}
            </span>
          )}
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

// --------------------------------------------------------------------------
// Asset preview (image / pdf / generic download)

function AssetPreview({ file, palette }: { file: IdeFile; palette: typeof APP_THEMES[AppThemeKey] }) {
  const asset = file.asset!;
  const sizeKb = (asset.size / 1024).toFixed(1);
  const isImage = asset.mime.startsWith("image/");
  const isPdf = asset.mime === "application/pdf";
  return (
    <div className="grid h-full grid-rows-[auto_1fr] overflow-hidden">
      <div className="flex items-center gap-2 border-b px-3 py-2 text-xs" style={{ borderColor: palette.border, color: palette.subtle }}>
        {isImage ? <ImageIcon size={12} /> : <FileText size={12} />}
        <span className="truncate" style={{ color: palette.text }}>{file.path}</span>
        <span className="ml-auto opacity-70">{asset.mime} · {sizeKb} KB</span>
        <a href={asset.dataUrl} download={file.name}
          className="rounded-md border px-2 py-1 text-[11px] hover:bg-white/5"
          style={{ borderColor: palette.border, color: palette.text }}>Download</a>
      </div>
      <div className="overflow-auto p-4" style={{ background: palette.bg }}>
        {isImage && (
          <div className="grid h-full place-items-center">
            <img src={asset.dataUrl} alt={file.name} className="max-h-full max-w-full rounded-lg shadow-lg" />
          </div>
        )}
        {isPdf && (
          <iframe title={file.name} src={asset.dataUrl} className="h-full min-h-[400px] w-full rounded-lg border-0" />
        )}
        {!isImage && !isPdf && (
          <div className="grid h-full place-items-center text-center text-xs" style={{ color: palette.subtle }}>
            Binary asset — use Download to save it.
          </div>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Files tree (folders + files + asset upload)

interface FilesTreeProps {
  files: IdeFile[];
  folders: string[];
  activeFileId: string;
  palette: typeof APP_THEMES[AppThemeKey];
  onOpen: (id: string) => void;
  onAddFile: (name: string, folder?: string) => void;
  onAddFolder: (path: string) => void;
  onDeleteFile: (id: string) => void;
  onDeleteFolder: (path: string) => void;
  onRenameFile: (id: string, newPath: string) => string | null;
  onUploadAssets: (files: FileList, folder?: string) => void;
  uploads: UploadItem[];
  onClearUploads: () => void;
  onOpenTemplates: () => void;
}

function FilesTree(p: FilesTreeProps) {
  const allFolders = useMemo(() => {
    const set = new Set<string>(p.folders);
    p.files.forEach((f) => {
      const d = dirname(f.path);
      if (!d) return;
      // include every ancestor path
      const parts = d.split("/");
      for (let i = 1; i <= parts.length; i++) set.add(parts.slice(0, i).join("/"));
    });
    return Array.from(set).sort();
  }, [p.files, p.folders]);

  const rootFiles = p.files.filter((f) => !dirname(f.path)).sort((a, b) => a.name.localeCompare(b.name));
  const filesByFolder = new Map<string, IdeFile[]>();
  p.files.forEach((f) => {
    const d = dirname(f.path);
    if (!d) return;
    const arr = filesByFolder.get(d) ?? [];
    arr.push(f);
    filesByFolder.set(d, arr);
  });
  filesByFolder.forEach((arr) => arr.sort((a, b) => a.name.localeCompare(b.name)));

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (path: string) => setCollapsed((c) => {
    const n = new Set(c);
    if (n.has(path)) n.delete(path); else n.add(path);
    return n;
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [targetFolder, setTargetFolder] = useState<string>("assets");

  function promptNewFile(folder = "") {
    const name = prompt(`New file name${folder ? ` (in ${folder}/)` : ""}`, "");
    if (!name) return;
    p.onAddFile(name.trim(), folder);
  }
  function promptNewFolder() {
    const path = prompt("Folder path (e.g. src or src/utils)", "");
    if (!path) return;
    p.onAddFolder(path);
  }
  function triggerUpload(folder: string) {
    setTargetFolder(folder);
    fileInputRef.current?.click();
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="grid grid-cols-3 gap-1 border-b p-2" style={{ borderColor: p.palette.border }}>
        <Button size="sm" onClick={() => promptNewFile("")}
          style={{ background: "linear-gradient(160deg,#4f8cff,#7e5bff)", color: "#fff" }}>
          <FilePlus2 size={13} className="mr-1" /> File
        </Button>
        <Button size="sm" variant="outline" onClick={promptNewFolder}
          className="border-border/60 bg-background text-foreground hover:bg-muted hover:text-foreground">
          <FolderPlus size={13} className="mr-1" /> Folder
        </Button>
        <Button size="sm" variant="outline" onClick={() => triggerUpload("assets")}
          className="border-border/60 bg-background text-foreground hover:bg-muted hover:text-foreground">
          <Upload size={13} className="mr-1" /> Asset
        </Button>
      </div>
      <Button size="sm" variant="ghost" className="mx-2 mt-2 justify-start" onClick={p.onOpenTemplates}>
        <LayoutGrid size={13} className="mr-1" /> Browse templates
      </Button>
      <input ref={fileInputRef} type="file" accept="image/*,application/pdf"
        multiple style={{ display: "none" }}
        onChange={(e) => { if (e.target.files) { p.onUploadAssets(e.target.files, targetFolder); e.target.value = ""; } }} />

      {p.uploads.length > 0 && (
        <div className="mx-2 mt-2 rounded-md border p-2 text-[11px]" style={{ borderColor: p.palette.border, background: p.palette.bg }}>
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold" style={{ color: p.palette.text }}>
              Uploads ({p.uploads.filter((u) => u.status === "done").length}/{p.uploads.length})
            </span>
            <button onClick={p.onClearUploads} className="opacity-60 hover:opacity-100">Clear</button>
          </div>
          <ul className="grid gap-1">
            {p.uploads.map((u) => (
              <li key={u.id} className="flex items-center gap-2">
                <span className="flex-1 truncate" title={u.name} style={{ color: p.palette.text }}>{u.name}</span>
                <span className="opacity-60">{(u.size / 1024).toFixed(0)} KB</span>
                {u.status === "pending" && <Loader2 size={12} className="animate-spin" />}
                {u.status === "done" && <span style={{ color: "#5fd38a" }}>✓</span>}
                {u.status === "error" && <span style={{ color: "#ff6f8a" }} title={u.error}>✕</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto px-2 pb-4 pt-2">
        <ul className="grid gap-0.5">
          {rootFiles.map((f) => (
            <FileRow key={f.id} file={f} active={f.id === p.activeFileId} palette={p.palette}
              canDelete={p.files.length > 1}
              onOpen={() => p.onOpen(f.id)}
              onDelete={() => p.onDeleteFile(f.id)}
              onRename={(next) => p.onRenameFile(f.id, next)} />
          ))}
          {allFolders.map((folder) => {
            const isCol = collapsed.has(folder);
            const isAssets = folder === "assets" || folder.startsWith("assets/");
            const inside = filesByFolder.get(folder) ?? [];
            const depth = folder.split("/").length - 1;
            return (
              <li key={folder} style={{ marginLeft: depth * 12 }}>
                <div className="flex items-center gap-1 rounded-md px-1 py-1 text-sm hover:bg-white/5">
                  <button onClick={() => toggle(folder)} className="grid h-5 w-5 place-items-center">
                    {isCol ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {isCol ? <Folder size={13} className="opacity-80" /> : <FolderOpenIcon size={13} className="opacity-80" />}
                  <button onClick={() => toggle(folder)} className="flex-1 truncate text-left font-medium" title={folder}>
                    {folder.split("/").pop()}
                  </button>
                  {isAssets ? (
                    <button onClick={() => triggerUpload(folder)} className="rounded p-1 opacity-70 hover:bg-white/10 hover:opacity-100" title="Upload asset">
                      <Upload size={12} />
                    </button>
                  ) : (
                    <button onClick={() => promptNewFile(folder)} className="rounded p-1 opacity-70 hover:bg-white/10 hover:opacity-100" title="Add file">
                      <Plus size={12} />
                    </button>
                  )}
                  <button onClick={() => {
                    if (confirm(`Delete folder "${folder}" and its files?`)) p.onDeleteFolder(folder);
                  }} className="rounded p-1 opacity-70 hover:bg-white/10 hover:opacity-100" title="Delete folder">
                    <Trash2 size={12} />
                  </button>
                </div>
                {!isCol && (
                  <ul className="ml-5 grid gap-0.5 border-l pl-2" style={{ borderColor: p.palette.border }}>
                    {inside.length === 0 && (
                      <li className="px-2 py-1 text-[11px] italic" style={{ color: p.palette.subtle }}>empty</li>
                    )}
                    {inside.map((f) => (
                      <FileRow key={f.id} file={f} active={f.id === p.activeFileId} palette={p.palette}
                        canDelete={p.files.length > 1}
                        onOpen={() => p.onOpen(f.id)}
                        onDelete={() => p.onDeleteFile(f.id)}
                        onRename={(next) => p.onRenameFile(f.id, next)} />
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function FileRow({ file, active, palette, canDelete, onOpen, onDelete, onRename }: {
  file: IdeFile; active: boolean; palette: typeof APP_THEMES[AppThemeKey]; canDelete: boolean;
  onOpen: () => void; onDelete: () => void; onRename: (newPath: string) => string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(file.path);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function start() {
    setValue(file.path);
    setError(null);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }
  function commit() {
    if (value === file.path) { setEditing(false); return; }
    const err = onRename(value);
    if (err) { setError(err); return; }
    setEditing(false);
  }
  function cancel() { setEditing(false); setError(null); }

  if (editing) {
    return (
      <li className="rounded-md px-2 py-1" style={{ background: palette.bg }}>
        <div className="flex items-center gap-2">
          {file.asset
            ? (file.asset.mime.startsWith("image/") ? <ImageIcon size={12} /> : <FileText size={12} />)
            : <FileIcon name={file.name} />}
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(null); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(); }
              if (e.key === "Escape") { e.preventDefault(); cancel(); }
            }}
            className="h-7 flex-1 rounded border bg-transparent px-2 text-xs"
            style={{ borderColor: error ? "#ff6f8a" : palette.border, color: palette.text }}
          />
          <button onClick={commit} className="rounded p-1 hover:bg-white/10" title="Save"><span style={{ color: "#5fd38a" }}>✓</span></button>
          <button onClick={cancel} className="rounded p-1 hover:bg-white/10" title="Cancel"><X size={12} /></button>
        </div>
        {error && <div className="ml-6 mt-1 text-[10px]" style={{ color: "#ff6f8a" }}>{error}</div>}
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 rounded-md px-2 py-1"
      style={{ background: active ? palette.bg : "transparent" }}>
      {file.asset
        ? (file.asset.mime.startsWith("image/") ? <ImageIcon size={12} /> : <FileText size={12} />)
        : <FileIcon name={file.name} />}
      <button className="flex-1 truncate text-left text-sm" onClick={onOpen} title={file.path}>
        {file.name}
      </button>
      <button onClick={start} className="rounded p-1 opacity-70 hover:bg-white/10 hover:opacity-100" title="Rename">
        <Pencil size={12} />
      </button>
      {canDelete && (
        <button onClick={onDelete} className="rounded p-1 opacity-70 hover:bg-white/10 hover:opacity-100" title="Delete">
          <Trash2 size={12} />
        </button>
      )}
    </li>
  );
}



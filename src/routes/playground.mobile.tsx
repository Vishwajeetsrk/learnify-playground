import { createFileRoute } from "@tanstack/react-router";
import Editor from "@monaco-editor/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshCw,
  RotateCw,
  Smartphone,
  Save,
  FolderOpen,
  FilePlus2,
  Pencil,
  Trash2,
  Loader2,
  Play,
  Copy,

  Square,
  Wifi,
  Signal,
  BatteryFull,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AiDebugPanel } from "@/components/ai-debug-panel";
import { runCode, PROVIDERS, type ProviderKey } from "@/lib/executors";
import {
  deleteMobileProject,
  listMobileProjects,
  loadMobileProject,
  renameMobileProject,
  saveMobileProject,
} from "@/lib/playground-projects.functions";
import { supabase } from "@/integrations/supabase/client";
import { preprocessJava, parseJavaErrors } from "@/lib/java-preprocess";

// Android-flavoured Java starter. Wandbox compiles it as a normal Java program
// (the playground runs JVM bytecode, not a real Android emulator), but the
// structure mirrors what a beginner would write inside an Activity's
// onCreate(). Output is rendered inside the phone "screen" as logcat lines.
const STARTER_JAVA = `// Android-style Java. The playground compiles this with the JVM
// (Wandbox names the file prog.java, so the outer class is package-private).
import java.util.*;

class MainActivity {
    // Simulated Android lifecycle entry point.
    public static void main(String[] args) {
        Log.d("MainActivity", "onCreate()");

        String[] items = { "Inbox", "Starred", "Today", "Settings" };
        for (int i = 0; i < items.length; i++) {
            Log.i("MainActivity", "item " + (i + 1) + ": " + items[i]);
        }

        int taps = 0;
        for (int i = 0; i < 3; i++) {
            taps++;
            Log.d("Button", "Tapped " + taps + " times");
        }

        Log.i("MainActivity", "Hello from your Android app!");
    }

    // Minimal Log shim so the program compiles outside Android.
    static class Log {
        static void d(String tag, String msg) { System.out.println(tag + " D: " + msg); }
        static void i(String tag, String msg) { System.out.println(tag + " I: " + msg); }
        static void w(String tag, String msg) { System.err.println(tag + " W: " + msg); }
        static void e(String tag, String msg) { System.err.println(tag + " E: " + msg); }
    }
}
`;

type DeviceKey = "iphone15" | "iphoneSE" | "pixel8" | "galaxyS24" | "ipadMini";
const DEVICES: Record<
  DeviceKey,
  { label: string; w: number; h: number; radius: number; notch: boolean }
> = {
  pixel8: { label: "Pixel 8", w: 412, h: 915, radius: 36, notch: true },
  galaxyS24: { label: "Galaxy S24", w: 384, h: 854, radius: 32, notch: true },
  iphone15: { label: "iPhone 15", w: 393, h: 852, radius: 48, notch: true },
  iphoneSE: { label: "iPhone SE", w: 375, h: 667, radius: 22, notch: false },
  ipadMini: { label: "iPad mini", w: 744, h: 1133, radius: 24, notch: false },
};

const LS = {
  device: "mobile-pg:device",
  landscape: "mobile-pg:landscape",
  scale: "mobile-pg:scale",
  code: "mobile-pg:code-java",
  projectId: "mobile-pg:projectId",
  projectName: "mobile-pg:projectName",
};

export const Route = createFileRoute("/playground/mobile")({
  // Monaco editor + device frame are client-only; SSR throws "Element type is invalid".
  ssr: false,
  head: () => ({
    meta: [
      { title: "Android Mobile Playground" },
      {
        name: "description",
        content:
          "Write and run Java code for Android-style mobile apps. Click Run inside the phone preview to see logcat output.",
      },
    ],
  }),
  component: MobilePlayground,
});

type ProjectRow = { id: string; name: string; updated_at: string };

interface LogLine {
  stream: "out" | "err" | "sys";
  text: string;
}

function parseLogcat(stdout: string, stderr: string): LogLine[] {
  const out: LogLine[] = [];
  for (const line of stdout.split("\n"))
    if (line.length) out.push({ stream: "out", text: line });
  for (const line of stderr.split("\n"))
    if (line.length) out.push({ stream: "err", text: line });
  return out;
}

// Derive a tiny "rendered app" view from logcat output. The playground compiles
// Java via Wandbox (no Android emulator), so we simulate the UI a beginner
// would expect by reading the Log.i/Log.d statements they wrote.
interface AppModel {
  title: string;
  items: string[];
  taps: number;
  banner: string | null;
  hasOnCreate: boolean;
}
function deriveAppModel(logs: LogLine[]): AppModel {
  const items: string[] = [];
  let title = "MainActivity";
  let banner: string | null = null;
  let taps = 0;
  let hasOnCreate = false;
  for (const l of logs) {
    if (l.stream === "sys") continue;
    const m = l.text.match(/^([\w.$]+)\s+([DIEW]):\s*(.*)$/);
    if (!m) continue;
    const tag = m[1];
    const msg = m[3];
    if (/^onCreate/i.test(msg)) { hasOnCreate = true; if (tag) title = tag; continue; }
    const item = msg.match(/^item\s+\d+\s*[:\-]\s*(.+)$/i);
    if (item) { items.push(item[1].trim()); continue; }
    const tap = msg.match(/Tapped\s+(\d+)\s+times?/i);
    if (tap) { taps = Math.max(taps, parseInt(tap[1], 10)); continue; }
    if (msg.length > 2) banner = msg;
  }
  return { title, items, taps, banner, hasOnCreate };
}

function MobilePlayground() {
  const [code, setCode] = useState(STARTER_JAVA);
  const [device, setDevice] = useState<DeviceKey>("pixel8");
  const [landscape, setLandscape] = useState(false);
  const [scale, setScale] = useState(0.75);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [activeProvider, setActiveProvider] = useState<ProviderKey>("wandbox");
  const [fallbackInfo, setFallbackInfo] = useState<{
    from: ProviderKey;
    to: ProviderKey;
    reason: string;
  } | null>(null);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("");
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const hydratedRef = useRef(false);
  const screenRef = useRef<HTMLDivElement | null>(null);

  const list = useServerFn(listMobileProjects);
  const loadFn = useServerFn(loadMobileProject);
  const saveFn = useServerFn(saveMobileProject);
  const renameFn = useServerFn(renameMobileProject);
  const deleteFn = useServerFn(deleteMobileProject);

  // Hydrate from localStorage once.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    try {
      const d = localStorage.getItem(LS.device);
      if (d && d in DEVICES) setDevice(d as DeviceKey);
      const l = localStorage.getItem(LS.landscape);
      if (l) setLandscape(l === "1");
      const s = localStorage.getItem(LS.scale);
      if (s) setScale(Math.min(1, Math.max(0.4, Number(s) || 0.75)));
      const c = localStorage.getItem(LS.code);
      if (c !== null) setCode(c);
      const pid = localStorage.getItem(LS.projectId);
      const pname = localStorage.getItem(LS.projectName);
      if (pid) setProjectId(pid);
      if (pname) setProjectName(pname);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (hydratedRef.current) try { localStorage.setItem(LS.device, device); } catch {}
  }, [device]);
  useEffect(() => {
    if (hydratedRef.current) try { localStorage.setItem(LS.landscape, landscape ? "1" : "0"); } catch {}
  }, [landscape]);
  useEffect(() => {
    if (hydratedRef.current) try { localStorage.setItem(LS.scale, String(scale)); } catch {}
  }, [scale]);
  useEffect(() => {
    if (hydratedRef.current) try { localStorage.setItem(LS.code, code); } catch {}
  }, [code]);
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      if (projectId) localStorage.setItem(LS.projectId, projectId);
      else localStorage.removeItem(LS.projectId);
      if (projectName) localStorage.setItem(LS.projectName, projectName);
      else localStorage.removeItem(LS.projectName);
    } catch {}
  }, [projectId, projectName]);

  // Autoscroll logcat.
  useEffect(() => {
    if (screenRef.current) screenRef.current.scrollTop = screenRef.current.scrollHeight;
  }, [logs]);

  const d = DEVICES[device];
  const baseW = landscape ? d.h : d.w;
  const baseH = landscape ? d.w : d.h;

  async function handleRun() {
    if (running) return;
    setRunning(true);
    setLogs([{ stream: "sys", text: "▶ Building APK…" }]);
    setStdout("");
    setStderr("");
    setExitCode(null);
    setFallbackInfo(null);
    try {
      const pre = preprocessJava(code);
      if (pre.wrapped) {
        setLogs((p) => [
          ...p,
          { stream: "sys", text: `↻ No main() found — wrapped in class ${pre.mainClass}` },
        ]);
      } else if (pre.changed) {
        setLogs((p) => [
          ...p,
          { stream: "sys", text: `↻ Stripped 'public' from top-level types (compiled as ${pre.mainClass})` },
        ]);
      }
      const r = await runCode("java", pre.code, "", "wandbox", {
        fallback: true,
        onFallback: (info) => {
          toast.warning(
            `${PROVIDERS[info.from].label} unavailable — falling back to ${PROVIDERS[info.to].label}`,
            { description: info.reason },
          );
          setActiveProvider(info.to);
          setFallbackInfo(info);
          setLogs((p) => [
            ...p,
            { stream: "sys", text: `↻ Switched to ${PROVIDERS[info.to].label}: ${info.reason}` },
          ]);
        },
      });
      setActiveProvider(r.provider);
      setStdout(r.stdout);
      setStderr(r.stderr);
      setExitCode(r.code);
      const parsed = parseLogcat(r.stdout, r.stderr);
      const compileErrors = parseJavaErrors(r.stderr, pre.wrapped);
      const failed = (r.code ?? 0) !== 0;
      setLogs((p) => [
        ...p,
        { stream: "sys", text: failed ? `✗ Build failed on ${d.label}` : `✓ Launched on ${d.label}` },
        ...(compileErrors.length
          ? compileErrors.map((e) => ({
              stream: "err" as const,
              text: `Compile error (line ${e.line}): ${e.message}`,
            }))
          : []),
        ...parsed,
        { stream: "sys", text: `— exit ${r.code ?? "?"} —` },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStderr(msg);
      setLogs((p) => [...p, { stream: "err", text: msg }, { stream: "sys", text: "✗ Run failed" }]);
      toast.error("Run failed", { description: msg });
    } finally {
      setRunning(false);
    }
  }

  function handleClear() {
    setLogs([]);
    setStdout("");
    setStderr("");
    setExitCode(null);
  }

  // --- Project ops ---
  const refreshList = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setProjects([]);
        setProjectsLoaded(true);
        toast.message("Sign in to sync projects", {
          description: "Saved projects will appear once you log in.",
        });
        return;
      }
      const r = await list();
      setProjects(r.projects as ProjectRow[]);
      setProjectsLoaded(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/unauthor|401/i.test(msg)) {
        toast.message("Sign in to sync projects", {
          description: "Saved projects will appear once you log in.",
        });
      } else {
        toast.error("Could not load projects", { description: msg });
      }
      setProjectsLoaded(true);
    }
  }, [list]);

  async function handleOpen(id: string) {
    setBusy(true);
    try {
      const row = await loadFn({ data: { id } });
      const next = row.code ?? row.js ?? STARTER_JAVA;
      setCode(next);
      setProjectId(row.id);
      setProjectName(row.name);
      handleClear();
      toast.success(`Opened "${row.name}"`);
    } catch (e) {
      toast.error("Open failed", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(asNew: boolean) {
    let name = projectName;
    if (asNew || !projectId || !name) {
      const suggested = name || `Android app ${new Date().toLocaleString()}`;
      const input = window.prompt("Project name", suggested);
      if (!input) return;
      name = input.trim();
    }
    setBusy(true);
    try {
      const row = await saveFn({
        data: {
          id: asNew ? null : projectId,
          name,
          kind: "code",
          language: "java",
          code,
        },
      });
      setProjectId(row.id);
      setProjectName(row.name);
      toast.success(`Saved "${row.name}"`);
      refreshList();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/unauthor|401/i.test(msg)) {
        toast.error("Sign in required", { description: "Log in to save mobile projects." });
      } else {
        toast.error("Save failed", { description: msg });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRename() {
    if (!projectId) return;
    const name = window.prompt("Rename project", projectName);
    if (!name || name === projectName) return;
    setBusy(true);
    try {
      await renameFn({ data: { id: projectId, name: name.trim() } });
      setProjectName(name.trim());
      toast.success("Renamed");
      refreshList();
    } catch (e) {
      toast.error("Rename failed", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!projectId) return;
    if (!window.confirm(`Delete "${projectName}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteFn({ data: { id: projectId } });
      setProjectId(null);
      setProjectName("");
      toast.success("Deleted");
      refreshList();
    } catch (e) {
      toast.error("Delete failed", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  function handleNew() {
    setCode(STARTER_JAVA);
    setProjectId(null);
    setProjectName("");
    handleClear();
    toast.message("New project started");
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col lg:h-[calc(100vh-3.5rem)]">
      <h1 className="sr-only">Android Mobile Playground</h1>

      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto border-b border-border/60 bg-card/40 p-2 [&::-webkit-scrollbar]:h-1">
        <Smartphone className="h-4 w-4 shrink-0 text-primary" />
        <span className="hidden shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:inline">
          Android · Java
        </span>
        <Select value={device} onValueChange={(v) => setDevice(v as DeviceKey)}>
          <SelectTrigger className="h-9 w-36 shrink-0" data-testid="device-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(DEVICES) as DeviceKey[]).map((k) => (
              <SelectItem key={k} value={k}>
                {DEVICES[k].label} · {DEVICES[k].w}×{DEVICES[k].h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setLandscape((s) => !s)}
          aria-pressed={landscape}
          title="Rotate"
          className="shrink-0"
        >
          <RotateCw className="mr-1 h-4 w-4" /> {landscape ? "Landscape" : "Portrait"}
        </Button>
        <label className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          Zoom
          <input
            type="range"
            min={0.4}
            max={1}
            step={0.05}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="w-20 accent-primary"
            data-testid="zoom-range"
          />
          <span className="w-8 font-mono text-[10px]" data-testid="zoom-label">
            {Math.round(scale * 100)}%
          </span>
        </label>

        <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">

          {projectName && (
            <span
              className="hidden max-w-[180px] truncate rounded-md border border-border/60 bg-background/60 px-2 py-1 font-mono text-[11px] text-muted-foreground sm:inline-block"
              title={projectName}
            >
              {projectName}
            </span>
          )}

          <DropdownMenu
            onOpenChange={(o) => {
              if (o && !projectsLoaded) refreshList();
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" data-testid="projects-menu" disabled={busy}>
                {busy ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <FolderOpen className="mr-1 h-4 w-4" />
                )}
                Projects
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onSelect={handleNew}>
                <FilePlus2 className="mr-2 h-4 w-4" /> New project
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleSave(false)}>
                <Save className="mr-2 h-4 w-4" /> {projectId ? "Save" : "Save…"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleSave(true)}>
                <Save className="mr-2 h-4 w-4" /> Save as…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleRename} disabled={!projectId}>
                <Pencil className="mr-2 h-4 w-4" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={handleDelete}
                disabled={!projectId}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Recent
              </DropdownMenuLabel>
              {!projectsLoaded && <DropdownMenuItem disabled>Loading…</DropdownMenuItem>}
              {projectsLoaded && projects.length === 0 && (
                <DropdownMenuItem disabled>No saved projects</DropdownMenuItem>
              )}
              {projects.slice(0, 10).map((p) => (
                <DropdownMenuItem key={p.id} onSelect={() => handleOpen(p.id)}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  <span className="truncate">{p.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="sm"
            onClick={handleRun}
            disabled={running}
            data-testid="run-button"
            title="Build & run on the selected device"
            className="shrink-0"
          >
            {running ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-1 h-4 w-4" />
            )}
            Run
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const text = logs.map((l) => l.text).join("\n");
              if (!text) {
                toast.message("Nothing to copy");
                return;
              }
              try {
                await navigator.clipboard.writeText(text);
                toast.success("Output copied");
              } catch (e) {
                toast.error("Copy failed", { description: e instanceof Error ? e.message : String(e) });
              }
            }}
            title="Copy logcat output"
            className="shrink-0"
            data-testid="copy-output"
          >
            <Copy className="mr-1 h-4 w-4" /> Copy
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={busy}
            title={projectId ? "Save project" : "Save as new project"}
            className="shrink-0"
            data-testid="save-project"
          >
            <Save className="mr-1 h-4 w-4" /> Save
          </Button>
          <Button size="sm" variant="outline" onClick={handleClear} title="Clear logcat" className="shrink-0">
            <Square className="mr-1 h-4 w-4" /> Clear
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRun}
            disabled={running}
            title="Rebuild & rerun"
            className="shrink-0"
          >
            <RefreshCw className="mr-1 h-4 w-4" /> Rerun
          </Button>

        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex h-[50vh] shrink-0 flex-col border-b border-border/60 lg:h-auto lg:flex-1 lg:border-b-0 lg:border-r">
          <Editor
            height="100%"
            language="java"
            value={code}
            theme="vs-dark"
            onChange={(v) => setCode(v ?? "")}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              automaticLayout: true,
              tabSize: 4,
            }}
          />
        </div>

        <div className="flex w-full min-w-0 flex-col lg:w-[55%]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-card/40 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Smartphone className="h-3.5 w-3.5" />
              Phone preview
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] tracking-normal ${
                  fallbackInfo
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                    : "border-primary/40 bg-primary/10 text-primary"
                }`}
                title={
                  fallbackInfo
                    ? `Fell back from ${PROVIDERS[fallbackInfo.from].label}: ${fallbackInfo.reason}`
                    : `Built by ${PROVIDERS[activeProvider].label}`
                }
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {PROVIDERS[activeProvider].label}
                {fallbackInfo && <span className="opacity-70">· fallback</span>}
              </span>
              <span
                className="rounded-md border border-border/40 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/80"
                data-testid="device-info"
              >
                {d.label} · {baseW}×{baseH}
              </span>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center overflow-auto bg-gradient-to-br from-slate-900 via-zinc-900 to-slate-950 p-6">
            <PhoneFrame
              device={d}
              baseW={baseW}
              baseH={baseH}
              landscape={landscape}
              scale={scale}
              running={running}
              logs={logs}
              screenRef={screenRef}
              onRun={handleRun}
              onClear={handleClear}
              onRerun={handleRun}
            />
          </div>

          <AiDebugPanel
            language="java"
            code={code}
            stdout={stdout}
            stderr={stderr}
            exitCode={exitCode}
            provider={activeProvider}
            stdin=""
            onApplyFix={(next) => setCode(next)}
          />
        </div>
      </div>
    </div>
  );
}

// --- Realistic Android phone frame ---------------------------------------

interface PhoneFrameProps {
  device: { label: string; w: number; h: number; radius: number; notch: boolean };
  baseW: number;
  baseH: number;
  landscape: boolean;
  scale: number;
  running: boolean;
  logs: LogLine[];
  screenRef: React.RefObject<HTMLDivElement | null>;
  onRun: () => void;
  onClear: () => void;
  onRerun: () => void;
}

function PhoneFrame({
  device,
  baseW,
  baseH,
  landscape,
  scale,
  running,
  logs,
  screenRef,
  onRun,
  onClear,
  onRerun,
}: PhoneFrameProps) {
  const bezel = 14; // physical bezel thickness around the screen, in device px
  const outerW = (baseW + bezel * 2) * scale;
  const outerH = (baseH + bezel * 2) * scale;
  const radius = (device.radius + bezel) * scale;
  const now = useMemo(() => {
    const t = new Date();
    return `${t.getHours().toString().padStart(2, "0")}:${t.getMinutes().toString().padStart(2, "0")}`;
  }, [logs.length]);

  return (
    <div
      className="relative shrink-0"
      data-testid="device-frame"
      style={{ width: outerW, height: outerH }}
    >
      {/* Side buttons (right edge) */}
      <div
        aria-hidden
        className="absolute right-[-3px] rounded-r-sm bg-zinc-700"
        style={{ top: outerH * 0.18, width: 3, height: outerH * 0.06 }}
      />
      <div
        aria-hidden
        className="absolute right-[-3px] rounded-r-sm bg-zinc-700"
        style={{ top: outerH * 0.28, width: 3, height: outerH * 0.12 }}
      />
      {/* Volume rocker (left edge) */}
      <div
        aria-hidden
        className="absolute left-[-3px] rounded-l-sm bg-zinc-700"
        style={{ top: outerH * 0.22, width: 3, height: outerH * 0.16 }}
      />

      {/* Bezel / chassis */}
      <div
        className="relative h-full w-full bg-gradient-to-b from-zinc-900 to-black shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7),0_0_0_2px_rgba(255,255,255,0.04)_inset]"
        style={{
          borderRadius: radius,
          padding: bezel * scale,
        }}
      >
        {/* Screen */}
        <div
          data-testid="mobile-preview"
          style={{
            width: baseW,
            height: baseH,
            borderRadius: device.radius * scale,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            background:
              "radial-gradient(120% 80% at 50% 0%, #1e293b 0%, #0b1020 60%, #050814 100%)",
            color: "#e5e7eb",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Punch-hole / pill camera */}
          {device.notch && !landscape && (
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: 8,
                left: "50%",
                transform: "translateX(-50%)",
                width: 14,
                height: 14,
                borderRadius: 999,
                background: "#000",
                boxShadow: "0 0 0 2px #0f172a inset, 0 0 1px 1px rgba(255,255,255,0.06)",
                zIndex: 5,
              }}
            />
          )}

          {/* Android status bar */}
          <div
            style={{
              height: 30,
              padding: "0 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontFamily: "'Google Sans', system-ui, sans-serif",
              fontSize: 13,
              fontWeight: 600,
              color: "#e5e7eb",
              background: "transparent",
            }}
          >
            <span>{now}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Signal size={13} />
              <Wifi size={13} />
              <BatteryFull size={15} />
            </div>
          </div>

          <PhoneContent
            device={device}
            logs={logs}
            running={running}
            screenRef={screenRef}
          />


          {/* Floating Action Button */}
          <button
            type="button"
            onClick={onRun}
            disabled={running}
            data-testid="screen-run"
            aria-label={running ? "Building" : "Run app"}
            style={{
              position: "absolute",
              right: 18,
              bottom: 70,
              width: 56,
              height: 56,
              borderRadius: 18,
              border: 0,
              background: running
                ? "#475569"
                : "linear-gradient(135deg,#22c55e,#16a34a)",
              color: "white",
              boxShadow: "0 10px 25px -8px rgba(34,197,94,0.6)",
              cursor: running ? "wait" : "pointer",
              display: "grid",
              placeItems: "center",
              fontSize: 22,
            }}
          >
            {running ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Play className="h-5 w-5" style={{ marginLeft: 2 }} />
            )}
          </button>

          {/* Android nav bar — functional */}
          <div
            style={{
              height: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-around",
              padding: "0 24px",
              background: "rgba(2,6,23,0.55)",
              borderTop: "1px solid rgba(148,163,184,0.08)",
            }}
          >
            <NavBtn label="Back" onClick={onClear} title="Back — clear logcat">
              <span style={{ fontSize: 18, lineHeight: 1 }}>◁</span>
            </NavBtn>
            <NavBtn label="Home" onClick={onRerun} title="Home — rebuild & run">
              <span
                style={{
                  display: "inline-block",
                  width: 14,
                  height: 14,
                  border: "1.6px solid #e2e8f0",
                  borderRadius: 999,
                }}
              />
            </NavBtn>
            <NavBtn
              label="Recents"
              onClick={() => {
                if (screenRef.current) screenRef.current.scrollTop = 0;
              }}
              title="Recents — scroll logcat to top"
            >
              <span
                style={{
                  display: "inline-block",
                  width: 13,
                  height: 13,
                  border: "1.6px solid #e2e8f0",
                  borderRadius: 3,
                }}
              />
            </NavBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavBtn({
  children,
  label,
  onClick,
  title,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title}
      style={{
        flex: 1,
        height: "100%",
        background: "transparent",
        border: 0,
        color: "#e2e8f0",
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        opacity: 0.85,
        transition: "background 120ms, opacity 120ms",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}

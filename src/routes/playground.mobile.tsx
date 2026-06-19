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
  Square,
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

      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-card/40 p-2">
        <Smartphone className="h-4 w-4 text-primary" />
        <span className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:inline">
          Android · Java
        </span>
        <Select value={device} onValueChange={(v) => setDevice(v as DeviceKey)}>
          <SelectTrigger className="h-9 w-36" data-testid="device-select">
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
        >
          <RotateCw className="mr-1 h-4 w-4" /> {landscape ? "Landscape" : "Portrait"}
        </Button>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
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

        <div className="ml-auto flex flex-wrap items-center gap-2">
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
          >
            {running ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-1 h-4 w-4" />
            )}
            Run
          </Button>
          <Button size="sm" variant="outline" onClick={handleClear} title="Clear logcat">
            <Square className="mr-1 h-4 w-4" /> Clear
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRun}
            disabled={running}
            title="Rebuild & rerun"
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
          <div className="flex items-center justify-between border-b border-border/60 bg-card/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Phone preview · logcat</span>
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] normal-case tracking-normal ${
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
                className="font-mono text-[10px] normal-case tracking-normal text-muted-foreground/80"
                data-testid="device-info"
              >
                {d.label} · {baseW}×{baseH}
              </span>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center overflow-auto bg-gradient-to-br from-muted/40 to-background p-4">
            <div
              className="relative shrink-0 bg-black shadow-2xl"
              data-testid="device-frame"
              style={{
                width: baseW * scale + 24,
                height: baseH * scale + 24,
                borderRadius: (d.radius + 6) * scale,
                padding: 12 * scale,
              }}
            >
              {d.notch && !landscape && (
                <div
                  className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full bg-black"
                  style={{ width: 110 * scale, height: 26 * scale }}
                  aria-hidden
                />
              )}
              <div
                data-testid="mobile-preview"
                style={{
                  width: baseW,
                  height: baseH,
                  borderRadius: d.radius,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  background: "#0b0b10",
                  color: "#e5e7eb",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                {/* Status bar */}
                <div
                  style={{
                    height: 28,
                    background: "linear-gradient(135deg,#16a34a,#059669)",
                    color: "white",
                    fontFamily: "system-ui, sans-serif",
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "6px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>{d.label.split(" ")[0]}</span>
                  <span>● ● ●</span>
                  <span>100%</span>
                </div>

                {/* Logcat */}
                <div
                  ref={screenRef}
                  data-testid="logcat"
                  style={{
                    flex: 1,
                    overflow: "auto",
                    padding: 12,
                    fontFamily:
                      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                    fontSize: 12,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {logs.length === 0 ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        color: "#9ca3af",
                        textAlign: "center",
                        gap: 16,
                        padding: 24,
                      }}
                    >
                      <div style={{ fontSize: 48 }}>📱</div>
                      <div style={{ fontWeight: 600, color: "#e5e7eb", fontSize: 14 }}>
                        Your Android app
                      </div>
                      <div style={{ fontSize: 12 }}>
                        Tap the button below to build &amp; launch your Java code.
                      </div>
                      <button
                        type="button"
                        onClick={handleRun}
                        disabled={running}
                        data-testid="screen-run"
                        style={{
                          marginTop: 8,
                          padding: "10px 24px",
                          borderRadius: 999,
                          border: 0,
                          background: running ? "#374151" : "#22c55e",
                          color: "white",
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: running ? "wait" : "pointer",
                        }}
                      >
                        {running ? "Building…" : "▶ Run app"}
                      </button>
                    </div>
                  ) : (
                    logs.map((l, i) => (
                      <div
                        key={i}
                        style={{
                          color:
                            l.stream === "err"
                              ? "#f87171"
                              : l.stream === "sys"
                                ? "#a78bfa"
                                : "#34d399",
                        }}
                      >
                        {l.text}
                      </div>
                    ))
                  )}
                </div>

                {/* Bottom nav */}
                <div
                  style={{
                    height: 40,
                    background: "#1f2937",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-around",
                    color: "#9ca3af",
                    fontSize: 18,
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <span>◁</span>
                  <span>○</span>
                  <span>▢</span>
                </div>
              </div>
            </div>
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

import { createFileRoute } from "@tanstack/react-router";
import Editor, { type OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play, Loader2, Database, Download, Eraser, FileDown, LayoutGrid,
  Settings as SettingsIcon, Sparkles, RefreshCw, Table as TableIcon,
} from "lucide-react";
import type { Database as SqlDb } from "sql.js";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  APP_THEMES, EDITOR_THEMES, useAppTheme, useEditorTheme, registerEditorThemes,
  type AppThemeKey, type EditorThemeKey,
} from "@/lib/playground/themes";
import { templatesForTrack, type CodeTemplate } from "@/lib/playground/templates";
import { loadSqlJs, runSql, exportCsv, exportJson, type ExecResult } from "@/lib/playground/sqljs";
import { TemplateIcon } from "@/lib/playground/icons";
import { AiDebugPanel } from "@/components/ai-debug-panel";
import { SchemaBuilder } from "@/components/playground/SchemaBuilder";

export const Route = createFileRoute("/playground/database")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Database Playground · SQLite in your browser" },
      { name: "description", content: "Run real SQL against an in-browser SQLite database. Create tables, insert data, run queries, and export results as CSV or JSON." },
    ],
  }),
  component: DatabasePlayground,
});

const DIALECTS = [
  { id: "sqlite",     label: "SQLite",     icon: "sqlite",   live: true },
  { id: "mysql",      label: "MySQL",      icon: "mysql",    live: false },
  { id: "postgresql", label: "PostgreSQL", icon: "postgres", live: false },
  { id: "mariadb",    label: "MariaDB",    icon: "mariadb",  live: false },
  { id: "mongodb",    label: "MongoDB",    icon: "mongodb",  live: false },
] as const;
type DialectId = typeof DIALECTS[number]["id"];

const LS_KEY = "playground-db:v1";

interface DbState { dialect: DialectId; projectName: string; source: string }

function defaultSource(): string {
  return `-- Welcome to the Database Playground.\n-- Tip: open the templates sheet for a starter schema.\n\nCREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, joined TEXT);\nINSERT INTO users (name, joined) VALUES ('Ada','2026-01-15'),('Linus','2026-02-04'),('Grace','2026-03-12');\n\nSELECT * FROM users ORDER BY joined;\n`;
}

function loadState(): DbState {
  if (typeof window === "undefined") return { dialect: "sqlite", projectName: "My Database", source: defaultSource() };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { dialect: "sqlite", projectName: "My Database", source: defaultSource() };
}

function DatabasePlayground() {
  const [state, setState] = useState<DbState>(() => loadState());
  const [appTheme, setAppTheme] = useAppTheme();
  const [editorTheme, setEditorTheme] = useEditorTheme();
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ExecResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState<"results" | "console" | "schema">("results");
  const [schemaTick, setSchemaTick] = useState(0);
  const dbRef = useRef<SqlDb | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const palette = APP_THEMES[appTheme];
  const templates = useMemo(() => templatesForTrack("database") as CodeTemplate[], []);

  // Initialise sql.js
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const SQL = await loadSqlJs();
        if (!alive) return;
        dbRef.current = new SQL.Database();
        setLoading(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    })();
    return () => { alive = false; dbRef.current?.close(); };
  }, []);

  // Autosave
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* ignore */ }
    }, 400);
    return () => clearTimeout(t);
  }, [state]);

  function resetDb() {
    try {
      dbRef.current?.close();
      loadSqlJs().then((SQL) => { dbRef.current = new SQL.Database(); toast.success("Fresh in-memory database"); });
      setResult(null); setError(null);
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  async function run() {
    if (state.dialect !== "sqlite") {
      toast.info(`${DIALECTS.find((d) => d.id === state.dialect)?.label} runs in editor-only mode.`, {
        description: "Use the AI assistant to explain or convert your query.",
      });
      return;
    }
    if (!dbRef.current) return;
    setRunning(true); setError(null);
    try {
      const r = runSql(dbRef.current, state.source);
      setResult(r);
      setBottomTab("results");
      toast.success(`Executed in ${r.ms} ms · ${r.blocks.reduce((s, b) => s + b.rows.length, 0)} rows`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setBottomTab("console");
    } finally { setRunning(false); }
  }

  function download(filename: string, body: string, mime: string) {
    const blob = new Blob([body], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function exportBlock(idx: number, kind: "csv" | "json") {
    if (!result?.blocks[idx]) return;
    const { columns, rows } = result.blocks[idx];
    if (kind === "csv") download(`result-${idx + 1}.csv`, exportCsv(columns, rows), "text/csv");
    else download(`result-${idx + 1}.json`, exportJson(columns, rows), "application/json");
  }

  const onMount = useCallback<OnMount>((ed, mn) => {
    editorRef.current = ed; registerEditorThemes(mn);
    ed.addCommand(mn.KeyMod.CtrlCmd | mn.KeyCode.KeyS, async () => {
      try {
        const { formatSource, getFormatOnSave } = await import("@/lib/playground/format");
        if (getFormatOnSave()) {
          const model = ed.getModel();
          if (model) {
            const out = await formatSource("sql", model.getValue());
            if (out != null && out !== model.getValue()) {
              const full = model.getFullModelRange();
              ed.executeEdits("format", [{ range: full, text: out, forceMoveMarkers: true }]);
              ed.pushUndoStop();
            }
          }
        }
      } catch { /* ignore */ }
      toast.success("Saved");
    });
  }, []);

  const dialectInfo = DIALECTS.find((d) => d.id === state.dialect)!;

  function loadTemplate(t: CodeTemplate) {
    setState((s) => ({ ...s, source: t.source, projectName: t.name }));
    setTemplatesOpen(false);
    setResult(null); setError(null);
    toast.success(`Loaded ${t.name}`);
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem)", background: palette.bg, color: palette.text }}>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-2 sm:px-3"
        style={{ borderColor: palette.border, background: palette.panel }}>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
          style={{ background: "linear-gradient(160deg,#4f8cff,#7e5bff)", color: "#fff" }}>
          <Database size={16} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <Input
            value={state.projectName}
            onChange={(e) => setState((s) => ({ ...s, projectName: e.target.value }))}
            className="h-7 w-full min-w-0 border-0 bg-transparent px-0 text-sm font-semibold focus-visible:ring-0"
            style={{ color: palette.text }}
          />
          <span className="truncate text-[10px]" style={{ color: palette.subtle }}>
            {dialectInfo.label} {dialectInfo.live ? "· live" : "· editor only"}
          </span>
        </div>

        <Select value={state.dialect} onValueChange={(v) => setState((s) => ({ ...s, dialect: v as DialectId }))}>
          <SelectTrigger className="h-9 w-32 shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DIALECTS.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                <span className="inline-flex items-center gap-2">
                  <TemplateIcon name={d.icon} size={14} /> {d.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="icon" variant="ghost" onClick={() => setTemplatesOpen(true)} className="h-9 w-9" title="Templates">
          <LayoutGrid size={16} />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => setAiOpen(true)} className="h-9 w-9" title="AI">
          <Sparkles size={16} />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => setSettingsOpen(true)} className="h-9 w-9" title="Settings">
          <SettingsIcon size={16} />
        </Button>
        <Button size="icon" variant="ghost" onClick={resetDb} className="h-9 w-9" title="Reset database">
          <RefreshCw size={16} />
        </Button>
        <Button size="sm" onClick={run} disabled={running || loading}
          className="ml-1 h-9 rounded-xl px-3 sm:px-4"
          style={{ background: "linear-gradient(160deg,#5fd38a,#4f8cff)", color: "#001028" }}>
          {running ? <Loader2 className="animate-spin sm:mr-1" size={14} /> : <Play size={14} className="sm:mr-1" />}
          <span className="hidden sm:inline">Run</span>
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1" style={{ background: palette.bg }}>
          {loading ? (
            <div className="grid h-full place-items-center text-sm" style={{ color: palette.subtle }}>
              <span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={14} /> Loading SQLite engine…</span>
            </div>
          ) : (
            <Editor
              height="100%"
              language="sql"
              value={state.source}
              theme={EDITOR_THEMES[editorTheme].monaco}
              onChange={(v) => setState((s) => ({ ...s, source: v ?? "" }))}
              onMount={onMount}
              options={{
                minimap: { enabled: false }, fontSize: 14, lineHeight: 22,
                tabSize: 2, scrollBeyondLastLine: false, automaticLayout: true,
                wordWrap: "on", padding: { top: 12, bottom: 12 },
              }}
            />
          )}
        </div>

        <div className="flex shrink-0 flex-col border-t" style={{ borderColor: palette.border, background: palette.panel, height: 340 }}>
          <div className="flex items-center gap-1 border-b px-2 py-1" style={{ borderColor: palette.border }}>
            <button onClick={() => setBottomTab("results")}
              className="inline-flex h-7 items-center rounded-md px-2.5 text-[11px] font-medium"
              style={{
                background: bottomTab === "results" ? palette.bg : "transparent",
                color: palette.text,
                border: `1px solid ${bottomTab === "results" ? palette.border : "transparent"}`,
              }}>
              <TableIcon size={12} className="mr-1" /> Results
              {result && <span className="ml-1 text-[10px] opacity-70">{result.blocks.reduce((s, b) => s + b.rows.length, 0)} rows · {result.ms} ms</span>}
            </button>
            <button onClick={() => setBottomTab("console")}
              className="inline-flex h-7 items-center rounded-md px-2.5 text-[11px] font-medium"
              style={{
                background: bottomTab === "console" ? palette.bg : "transparent",
                color: palette.text,
                border: `1px solid ${bottomTab === "console" ? palette.border : "transparent"}`,
              }}>
              Console
            </button>
            <button onClick={() => { setSchemaTick((n) => n + 1); setBottomTab("schema"); }}
              className="inline-flex h-7 items-center rounded-md px-2.5 text-[11px] font-medium"
              style={{
                background: bottomTab === "schema" ? palette.bg : "transparent",
                color: palette.text,
                border: `1px solid ${bottomTab === "schema" ? palette.border : "transparent"}`,
              }}>
              <TableIcon size={12} className="mr-1" /> Schema Builder
            </button>
            <div className="ml-auto">
              {bottomTab === "results" && result && result.blocks.length > 0 && (
                <button onClick={() => exportBlock(0, "csv")}
                  className="inline-flex h-7 items-center rounded-md px-2 text-[11px] hover:bg-white/10">
                  <FileDown size={12} className="mr-1" /> CSV
                </button>
              )}
              {bottomTab === "console" && (
                <button onClick={() => { setError(null); setResult(null); }}
                  className="inline-flex h-7 items-center rounded-md px-2 text-[11px] hover:bg-white/10">
                  <Eraser size={12} className="mr-1" /> Clear
                </button>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {bottomTab === "results" && (
              <ResultsView result={result} subtle={palette.subtle} onExport={exportBlock} />
            )}
            {bottomTab === "console" && (
              <ConsoleView error={error} result={result} subtle={palette.subtle} />
            )}
            {bottomTab === "schema" && (
              <SchemaBuilder key={schemaTick} db={dbRef.current} onChange={() => { /* user can rerun query */ }} />
            )}
          </div>
        </div>
      </div>

      {/* Templates sheet */}
      <Sheet open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <SheetContent side="bottom" className="h-[80vh] p-0"
          style={{ background: palette.panel, color: palette.text, borderColor: palette.border }}>
          <SheetHeader className="border-b px-4 py-3" style={{ borderColor: palette.border }}>
            <SheetTitle style={{ color: palette.text }}>Database templates</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 overflow-auto p-3 sm:grid-cols-3">
            <button onClick={() => { setState((s) => ({ ...s, source: defaultSource(), projectName: "Untitled" })); setTemplatesOpen(false); }}
              className="flex flex-col items-start gap-2 rounded-xl border p-3 text-left"
              style={{ borderColor: palette.border, background: palette.bg }}>
              <TemplateIcon name="database" size={24} />
              <span className="text-sm font-semibold">Blank database</span>
              <span className="text-[11px]" style={{ color: palette.subtle }}>Starter SQLite schema</span>
            </button>
            {templates.map((t) => (
              <button key={t.id} onClick={() => loadTemplate(t)}
                className="flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition hover:-translate-y-0.5"
                style={{ borderColor: palette.border, background: palette.bg }}>
                <TemplateIcon name={t.icon} size={24} />
                <span className="text-sm font-semibold">{t.name}</span>
                <span className="line-clamp-2 text-[11px]" style={{ color: palette.subtle }}>{t.description}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={aiOpen} onOpenChange={setAiOpen}>
        <SheetContent side="bottom" className="h-[85vh] overflow-hidden p-0"
          style={{ background: palette.panel, color: palette.text, borderColor: palette.border }}>
          <SheetHeader className="border-b px-4 py-3" style={{ borderColor: palette.border }}>
            <SheetTitle style={{ color: palette.text }}>
              <Sparkles size={14} className="mr-1 inline" /> SQL Assistant
            </SheetTitle>
          </SheetHeader>
          <div className="h-full overflow-auto p-2">
            <AiDebugPanel
              language="sql"
              code={state.source}
              stdout={result ? `${result.blocks.length} blocks · ${result.ms} ms` : ""}
              stderr={error ?? ""}
              exitCode={error ? 1 : 0}
              provider="wandbox"
              stdin=""
              onApplyFix={(next) => setState((s) => ({ ...s, source: next }))}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right" className="w-[320px] p-0"
          style={{ background: palette.panel, color: palette.text, borderColor: palette.border }}>
          <SheetHeader className="border-b px-4 py-3" style={{ borderColor: palette.border }}>
            <SheetTitle style={{ color: palette.text }}>Settings</SheetTitle>
          </SheetHeader>
          <div className="grid gap-4 p-4">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium opacity-70">App theme</label>
              <Select value={appTheme} onValueChange={(v) => setAppTheme(v as AppThemeKey)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(APP_THEMES) as AppThemeKey[]).map((k) => (
                    <SelectItem key={k} value={k}>{APP_THEMES[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium opacity-70">Editor theme</label>
              <Select value={editorTheme} onValueChange={(v) => setEditorTheme(v as EditorThemeKey)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(EDITOR_THEMES) as EditorThemeKey[]).map((k) => (
                    <SelectItem key={k} value={k}>{EDITOR_THEMES[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border p-3 text-xs" style={{ borderColor: palette.border, color: palette.subtle }}>
              SQLite runs entirely in your browser via sql.js. MySQL, PostgreSQL, MariaDB, and MongoDB are editor-only — use the AI assistant to lint or convert.
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ResultsView({ result, subtle, onExport }: { result: ExecResult | null; subtle: string; onExport: (i: number, k: "csv" | "json") => void }) {
  if (!result) return (
    <div className="grid h-full place-items-center p-4 text-center text-xs" style={{ color: subtle }}>
      Run a query to see results here.
    </div>
  );
  if (result.blocks.length === 0) return (
    <div className="grid h-full place-items-center p-4 text-center text-xs" style={{ color: subtle }}>
      Query executed in {result.ms} ms · {result.rowsChanged} rows changed (no rows returned).
    </div>
  );
  return (
    <div className="grid gap-3 p-2">
      {result.blocks.map((b, i) => (
        <div key={i} className="overflow-auto rounded-lg border border-white/10">
          <div className="flex items-center justify-between border-b border-white/10 px-2 py-1 text-[11px]" style={{ color: subtle }}>
            <span>Result {i + 1} · {b.rows.length} row{b.rows.length === 1 ? "" : "s"}</span>
            <div className="flex gap-1">
              <button onClick={() => onExport(i, "csv")} className="inline-flex h-6 items-center rounded px-1.5 hover:bg-white/10">
                <Download size={11} className="mr-1" /> CSV
              </button>
              <button onClick={() => onExport(i, "json")} className="inline-flex h-6 items-center rounded px-1.5 hover:bg-white/10">
                <Download size={11} className="mr-1" /> JSON
              </button>
            </div>
          </div>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-white/5">
                {b.columns.map((c, ci) => (
                  <th key={ci} className="border-b border-white/10 px-2 py-1.5 text-left font-semibold">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, ri) => (
                <tr key={ri} className="odd:bg-white/[0.02]">
                  {r.map((cell, ci) => (
                    <td key={ci} className="border-b border-white/5 px-2 py-1 font-mono align-top">
                      {cell === null ? <span className="opacity-50">NULL</span> : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function ConsoleView({ error, result, subtle }: { error: string | null; result: ExecResult | null; subtle: string }) {
  if (!error && !result) return (
    <div className="grid h-full place-items-center p-4 text-center text-xs" style={{ color: subtle }}>
      Query messages will appear here.
    </div>
  );
  return (
    <pre className="m-0 h-full overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed"
      style={{ background: "#000", color: error ? "#ff8a99" : "#7ce38b" }}>
      {error ?? `Executed in ${result?.ms ?? 0} ms · ${result?.blocks.length ?? 0} result block(s) · ${result?.rowsChanged ?? 0} rows modified.`}
    </pre>
  );
}

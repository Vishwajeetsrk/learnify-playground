// Compact, self-contained SQLite console for embedding inside other playgrounds.
// Tabs: SQL editor (run + results) + visual Schema builder.
// Persists SQL source and a snapshot of the in-memory database to localStorage.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Database } from "sql.js";
import { Database as DbIcon, Loader2, Play, RefreshCw, Table as TableIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { loadSqlJs, runSql, type ExecResult } from "@/lib/playground/sqljs";
import { SchemaBuilder } from "@/components/playground/SchemaBuilder";

interface Props { storageKey?: string }

export function DbConsole({ storageKey = "playground:embedded-db:v1" }: Props) {
  const [tab, setTab] = useState<"sql" | "schema">("schema");
  const [source, setSource] = useState<string>(() => {
    try { return localStorage.getItem(storageKey + ":sql") ?? "SELECT name FROM sqlite_master WHERE type='table';"; }
    catch { return ""; }
  });
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExecResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dbRef = useRef<Database | null>(null);
  const [, force] = useState(0);

  const persistDb = useCallback(() => {
    try {
      if (!dbRef.current) return;
      const bytes = dbRef.current.export();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
      localStorage.setItem(storageKey + ":db", b64);
    } catch { /* ignore */ }
  }, [storageKey]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const SQL = await loadSqlJs();
        if (!alive) return;
        let db: Database;
        try {
          const saved = localStorage.getItem(storageKey + ":db");
          if (saved) {
            const bin = Uint8Array.from(atob(saved), (c) => c.charCodeAt(0));
            db = new SQL.Database(bin);
          } else {
            db = new SQL.Database();
          }
        } catch { db = new SQL.Database(); }
        dbRef.current = db;
        setLoading(false);
        force((n) => n + 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    })();
    return () => { alive = false; dbRef.current?.close(); };
  }, [storageKey]);

  useEffect(() => {
    try { localStorage.setItem(storageKey + ":sql", source); } catch { /* ignore */ }
  }, [source, storageKey]);

  function run() {
    if (!dbRef.current) return;
    setRunning(true); setError(null);
    try {
      setResult(runSql(dbRef.current, source));
      persistDb();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setRunning(false); }
  }

  function reset() {
    if (!confirm("Wipe all tables and data in this embedded database?")) return;
    loadSqlJs().then((SQL) => {
      dbRef.current?.close();
      dbRef.current = new SQL.Database();
      try { localStorage.removeItem(storageKey + ":db"); } catch { /* ignore */ }
      setResult(null); setError(null);
      toast.success("Fresh database");
      force((n) => n + 1);
    });
  }

  if (loading) return (
    <div className="grid h-full place-items-center text-xs opacity-60">
      <span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={14} /> Loading SQLite…</span>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-white/10 px-2 py-1.5">
        <button onClick={() => setTab("schema")}
          className={`inline-flex h-7 items-center rounded-md px-2 text-[11px] ${tab === "schema" ? "bg-white/10" : "opacity-60 hover:opacity-100"}`}>
          <TableIcon size={11} className="mr-1" /> Schema
        </button>
        <button onClick={() => setTab("sql")}
          className={`inline-flex h-7 items-center rounded-md px-2 text-[11px] ${tab === "sql" ? "bg-white/10" : "opacity-60 hover:opacity-100"}`}>
          <DbIcon size={11} className="mr-1" /> SQL
        </button>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={reset}>
            <RefreshCw size={11} className="mr-1" /> Reset
          </Button>
          {tab === "sql" && (
            <Button size="sm" className="h-7 px-2 text-[11px]" onClick={run} disabled={running}>
              {running ? <Loader2 className="mr-1 animate-spin" size={11} /> : <Play size={11} className="mr-1" />}
              Run
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "schema" && (
          <SchemaBuilder db={dbRef.current} onChange={() => { persistDb(); force((n) => n + 1); }} />
        )}
        {tab === "sql" && (
          <div className="grid h-full grid-rows-2 divide-y divide-white/10">
            <textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="h-full w-full resize-none bg-black/40 p-2 font-mono text-xs outline-none"
              spellCheck={false}
              placeholder="SELECT * FROM ..."
            />
            <div className="overflow-auto p-2 text-xs">
              {error && <div className="rounded bg-red-500/15 p-2 text-red-200">{error}</div>}
              {!error && !result && <div className="opacity-60">Run a query to see results.</div>}
              {result?.blocks.map((b, i) => (
                <div key={i} className="mb-2 overflow-auto rounded border border-white/10">
                  <table className="w-full text-[11px]">
                    <thead className="bg-white/5">
                      <tr>{b.columns.map((c) => <th key={c} className="px-2 py-1 text-left">{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      {b.rows.map((r, ri) => (
                        <tr key={ri} className="border-t border-white/5">
                          {r.map((cell, ci) => (
                            <td key={ci} className="px-2 py-1 font-mono">{cell === null ? <span className="opacity-50">NULL</span> : String(cell)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              {result && result.blocks.length === 0 && (
                <div className="opacity-60">OK · {result.rowsChanged} row(s) modified in {result.ms} ms.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

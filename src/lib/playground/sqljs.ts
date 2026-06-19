// Lazy-loaded in-browser SQLite via sql.js (WASM).
// The WASM file is fetched from a CDN so we don't have to copy it into /public.
import type { Database, SqlJsStatic } from "sql.js";

let cached: Promise<SqlJsStatic> | null = null;

export function loadSqlJs(): Promise<SqlJsStatic> {
  if (cached) return cached;
  cached = (async () => {
    const initSqlJs = (await import("sql.js")).default;
    return initSqlJs({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/${file}`,
    });
  })();
  return cached;
}

export interface ExecResult {
  /** Time spent executing, in milliseconds. */
  ms: number;
  /** One block per statement that produced rows. */
  blocks: { columns: string[]; rows: unknown[][] }[];
  /** Rows changed by the last statement that wrote (INSERT/UPDATE/DELETE). */
  rowsChanged: number;
}

export function runSql(db: Database, sql: string): ExecResult {
  const start = performance.now();
  const blocks = db.exec(sql).map((r) => ({ columns: r.columns, rows: r.values }));
  const ms = Math.round(performance.now() - start);
  let rowsChanged = 0;
  try { rowsChanged = db.getRowsModified(); } catch { /* ignore */ }
  return { ms, blocks, rowsChanged };
}

export function exportCsv(columns: string[], rows: unknown[][]): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}

export function exportJson(columns: string[], rows: unknown[][]): string {
  return JSON.stringify(rows.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i]]))), null, 2);
}

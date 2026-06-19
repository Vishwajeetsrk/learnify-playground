// Visual SQL schema + data builder for sql.js (SQLite).
// Reads live schema with sqlite_master + PRAGMA, lets the user add tables,
// columns, and rows without writing SQL. Mutations are executed against the
// passed-in Database via the runStatement callback so the parent can refresh
// results and persist as needed.
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Database } from "sql.js";
import {
  Database as DbIcon, KeyRound, Link2, Network, Plus, RefreshCw, Table as TableIcon,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SchemaDiagram } from "./SchemaDiagram";

const SQL_TYPES = ["INTEGER", "TEXT", "REAL", "NUMERIC", "BLOB", "BOOLEAN", "DATE", "DATETIME"] as const;
type SqlType = typeof SQL_TYPES[number];

interface ColDraft {
  name: string;
  type: SqlType;
  pk: boolean;
  notNull: boolean;
  unique: boolean;
  defaultValue: string;
  references: string; // "tableName(column)" or empty
}

interface TableInfo {
  name: string;
  columns: { cid: number; name: string; type: string; notnull: number; dflt_value: unknown; pk: number }[];
  fks: { from: string; table: string; to: string }[];
  rowCount: number;
}

export interface SchemaBuilderProps {
  db: Database | null;
  /** Called whenever the schema or data changes so the parent can refresh views. */
  onChange?: () => void;
}

function quoteIdent(s: string) { return `"${s.replace(/"/g, '""')}"`; }
function quoteValue(v: string): string {
  if (v === "") return "NULL";
  if (/^-?\d+(\.\d+)?$/.test(v)) return v;
  if (/^(NULL|true|false)$/i.test(v)) return v.toUpperCase();
  return `'${v.replace(/'/g, "''")}'`;
}

export function SchemaBuilder({ db, onChange }: SchemaBuilderProps) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<"editor" | "diagram">("editor");

  const refresh = useCallback(() => {
    if (!db) { setTables([]); return; }
    try {
      const list = db.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      );
      const names: string[] = list[0]?.values.map((r) => String(r[0])) ?? [];
      const info: TableInfo[] = names.map((n) => {
        const cols = db.exec(`PRAGMA table_info(${quoteIdent(n)})`)[0];
        const fks = db.exec(`PRAGMA foreign_key_list(${quoteIdent(n)})`)[0];
        const cnt = db.exec(`SELECT COUNT(*) FROM ${quoteIdent(n)}`)[0];
        return {
          name: n,
          columns: (cols?.values ?? []).map((r) => ({
            cid: Number(r[0]), name: String(r[1]), type: String(r[2]),
            notnull: Number(r[3]), dflt_value: r[4], pk: Number(r[5]),
          })),
          fks: (fks?.values ?? []).map((r) => ({
            from: String(r[3]), table: String(r[2]), to: String(r[4]),
          })),
          rowCount: Number(cnt?.values[0][0] ?? 0),
        };
      });
      setTables(info);
      if (selected && !names.includes(selected)) setSelected(names[0] ?? null);
      if (!selected && names.length > 0) setSelected(names[0]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }, [db, selected]);

  useEffect(() => { refresh(); }, [db, refresh]);

  function exec(sql: string, successMsg?: string) {
    if (!db) return;
    try {
      db.run(sql);
      if (successMsg) toast.success(successMsg);
      refresh();
      onChange?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  const active = useMemo(() => tables.find((t) => t.name === selected) ?? null, [tables, selected]);

  function dropTable(name: string) {
    if (!confirm(`Drop table "${name}"? This deletes all its rows.`)) return;
    exec(`DROP TABLE ${quoteIdent(name)}`, `Dropped ${name}`);
  }
  function dropColumn(table: string, col: string) {
    if (!confirm(`Drop column "${col}"?`)) return;
    exec(`ALTER TABLE ${quoteIdent(table)} DROP COLUMN ${quoteIdent(col)}`, "Column dropped");
  }
  function addColumn(table: string, c: ColDraft) {
    let line = `${quoteIdent(c.name)} ${c.type}`;
    if (c.notNull) line += " NOT NULL";
    if (c.unique) line += " UNIQUE";
    if (c.defaultValue.trim()) line += ` DEFAULT ${quoteValue(c.defaultValue.trim())}`;
    if (c.references.trim()) line += ` REFERENCES ${c.references.trim()}`;
    exec(`ALTER TABLE ${quoteIdent(table)} ADD COLUMN ${line}`, "Column added");
  }

  if (!db) {
    return (
      <div className="grid h-full place-items-center p-4 text-center text-xs opacity-60">
        <span><DbIcon className="mx-auto mb-2" size={20} />Loading SQLite engine…</span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-2 py-1.5">
        <DbIcon size={14} className="opacity-70" />
        <span className="text-xs font-semibold">Schema</span>
        <span className="text-[11px] opacity-60">{tables.length} table{tables.length === 1 ? "" : "s"}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => setView((v) => v === "editor" ? "diagram" : "editor")}>
            <Network size={11} className="mr-1" /> {view === "editor" ? "Diagram" : "Editor"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={refresh}>
            <RefreshCw size={11} className="mr-1" /> Refresh
          </Button>
          <Button size="sm" className="h-7 px-2 text-[11px]" onClick={() => setCreating(true)}>
            <Plus size={11} className="mr-1" /> New table
          </Button>
        </div>
      </div>

      {view === "diagram" ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <SchemaDiagram tables={tables.map((t) => ({
            name: t.name,
            columns: t.columns.map((c) => ({ name: c.name, type: c.type, pk: c.pk > 0, notnull: c.notnull > 0 })),
            fks: t.fks,
          }))} />
        </div>
      ) : (
      <div className="grid min-h-0 flex-1 grid-cols-[140px_1fr] divide-x divide-white/10">
        <aside className="overflow-auto p-1">
          {tables.length === 0 && (
            <div className="px-2 py-3 text-[11px] opacity-60">No tables yet. Tap "New table".</div>
          )}
          {tables.map((t) => (
            <div key={t.name} className="flex items-center">
              <button onClick={() => setSelected(t.name)}
                className={`flex flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs ${selected === t.name ? "bg-white/10" : "hover:bg-white/5"}`}>
                <TableIcon size={11} className="opacity-70" />
                <span className="truncate">{t.name}</span>
                <span className="ml-auto text-[10px] opacity-50">{t.rowCount}</span>
              </button>
              <button onClick={() => dropTable(t.name)}
                className="ml-0.5 grid h-6 w-6 place-items-center rounded text-[10px] opacity-40 hover:bg-white/10 hover:opacity-100" title="Drop">
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </aside>

        <section className="overflow-auto p-2">
          {creating && (
            <CreateTablePanel onCancel={() => setCreating(false)} onCreate={(sql) => {
              exec(sql, "Table created");
              setCreating(false);
            }} />
          )}
          {!creating && !active && (
            <div className="grid h-full place-items-center text-[11px] opacity-60">
              {tables.length === 0 ? "Create your first table to begin." : "Select a table."}
            </div>
          )}
          {!creating && active && (
            <TableEditor table={active} onAddColumn={(c) => addColumn(active.name, c)}
              onDropColumn={(c) => dropColumn(active.name, c)} db={db} onMutate={() => { refresh(); onChange?.(); }} />
          )}
        </section>
      </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function CreateTablePanel({ onCancel, onCreate }: { onCancel: () => void; onCreate: (sql: string) => void }) {
  const [name, setName] = useState("new_table");
  const [cols, setCols] = useState<ColDraft[]>([
    { name: "id", type: "INTEGER", pk: true, notNull: true, unique: false, defaultValue: "", references: "" },
    { name: "name", type: "TEXT", pk: false, notNull: false, unique: false, defaultValue: "", references: "" },
  ]);

  function build(): string {
    const lines = cols.filter((c) => c.name.trim()).map((c) => {
      let line = `  ${quoteIdent(c.name.trim())} ${c.type}`;
      if (c.pk) line += " PRIMARY KEY";
      if (c.notNull) line += " NOT NULL";
      if (c.unique) line += " UNIQUE";
      if (c.defaultValue.trim()) line += ` DEFAULT ${quoteValue(c.defaultValue.trim())}`;
      if (c.references.trim()) line += ` REFERENCES ${c.references.trim()}`;
      return line;
    });
    return `CREATE TABLE ${quoteIdent(name.trim() || "untitled")} (\n${lines.join(",\n")}\n)`;
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <Input className="h-8 max-w-xs text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="table name" />
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={onCancel}>Cancel</Button>
          <Button size="sm" className="h-7 text-[11px]" onClick={() => onCreate(build())}>Create</Button>
        </div>
      </div>
      <div className="overflow-auto rounded-md border border-white/10">
        <table className="w-full text-[11px]">
          <thead className="bg-white/5 text-left">
            <tr>
              <th className="px-2 py-1.5">Column</th>
              <th className="px-2 py-1.5">Type</th>
              <th className="px-2 py-1.5">PK</th>
              <th className="px-2 py-1.5">NOT NULL</th>
              <th className="px-2 py-1.5">UNIQUE</th>
              <th className="px-2 py-1.5">Default</th>
              <th className="px-2 py-1.5">References</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cols.map((c, i) => (
              <tr key={i} className="border-t border-white/5">
                <td className="px-1 py-1"><Input className="h-7 text-[11px]" value={c.name} onChange={(e) => setCols((s) => s.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /></td>
                <td className="px-1 py-1">
                  <Select value={c.type} onValueChange={(v) => setCols((s) => s.map((x, j) => j === i ? { ...x, type: v as SqlType } : x))}>
                    <SelectTrigger className="h-7 w-24 text-[11px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{SQL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                {(["pk", "notNull", "unique"] as const).map((k) => (
                  <td key={k} className="px-1 py-1 text-center">
                    <input type="checkbox" checked={c[k]} onChange={(e) => setCols((s) => s.map((x, j) => j === i ? { ...x, [k]: e.target.checked } : x))} />
                  </td>
                ))}
                <td className="px-1 py-1"><Input className="h-7 w-20 text-[11px]" value={c.defaultValue} onChange={(e) => setCols((s) => s.map((x, j) => j === i ? { ...x, defaultValue: e.target.value } : x))} /></td>
                <td className="px-1 py-1"><Input className="h-7 w-32 text-[11px]" placeholder="table(col)" value={c.references} onChange={(e) => setCols((s) => s.map((x, j) => j === i ? { ...x, references: e.target.value } : x))} /></td>
                <td className="px-1 py-1">
                  <button onClick={() => setCols((s) => s.filter((_, j) => j !== i))}
                    className="grid h-6 w-6 place-items-center rounded opacity-50 hover:bg-white/10 hover:opacity-100"><Trash2 size={11} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button size="sm" variant="ghost" className="justify-start"
        onClick={() => setCols((s) => [...s, { name: "", type: "TEXT", pk: false, notNull: false, unique: false, defaultValue: "", references: "" }])}>
        <Plus size={12} className="mr-1" /> Add column
      </Button>
      <details className="rounded-md border border-white/10 p-2 text-[11px]">
        <summary className="cursor-pointer opacity-70">Preview SQL</summary>
        <pre className="mt-1 overflow-auto whitespace-pre-wrap font-mono">{build()}</pre>
      </details>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TableEditor({ table, onAddColumn, onDropColumn, db, onMutate }: {
  table: TableInfo;
  onAddColumn: (c: ColDraft) => void;
  onDropColumn: (name: string) => void;
  db: Database;
  onMutate: () => void;
}) {
  const [showAddCol, setShowAddCol] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadRows = useCallback(() => {
    try {
      const r = db.exec(`SELECT * FROM ${quoteIdent(table.name)} LIMIT 200`)[0];
      setCols(r?.columns ?? table.columns.map((c) => c.name));
      setRows(r?.values ?? []);
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [db, table.name, table.columns]);

  useEffect(() => { loadRows(); }, [loadRows, table.rowCount]);

  function insertRow(values: Record<string, string>) {
    const keys = Object.keys(values).filter((k) => values[k] !== "");
    if (keys.length === 0) { toast.error("Add at least one value"); return; }
    const sql = `INSERT INTO ${quoteIdent(table.name)} (${keys.map(quoteIdent).join(", ")}) VALUES (${keys.map((k) => quoteValue(values[k])).join(", ")})`;
    try { db.run(sql); toast.success("Row inserted"); setInsertOpen(false); onMutate(); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  function deleteRow(idx: number) {
    const pkCol = table.columns.find((c) => c.pk);
    if (!pkCol) { toast.error("Need a primary key column to delete rows"); return; }
    const pkIdx = cols.indexOf(pkCol.name);
    if (pkIdx < 0) return;
    const val = rows[idx][pkIdx];
    try {
      db.run(`DELETE FROM ${quoteIdent(table.name)} WHERE ${quoteIdent(pkCol.name)} = ?`, [val as never]);
      toast.success("Row deleted"); onMutate();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <TableIcon size={14} className="opacity-70" />
        <h3 className="text-sm font-semibold">{table.name}</h3>
        <span className="text-[11px] opacity-60">{table.rowCount} rows · {table.columns.length} columns</span>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => setShowAddCol((v) => !v)}>
            <Plus size={11} className="mr-1" /> Column
          </Button>
          <Button size="sm" className="h-7 px-2 text-[11px]" onClick={() => setInsertOpen((v) => !v)}>
            <Plus size={11} className="mr-1" /> Row
          </Button>
        </div>
      </div>

      <div className="overflow-auto rounded-md border border-white/10">
        <table className="w-full text-[11px]">
          <thead className="bg-white/5 text-left">
            <tr>
              <th className="px-2 py-1.5">Column</th>
              <th className="px-2 py-1.5">Type</th>
              <th className="px-2 py-1.5">Constraints</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {table.columns.map((c) => {
              const fk = table.fks.find((f) => f.from === c.name);
              return (
                <tr key={c.cid} className="border-t border-white/5">
                  <td className="px-2 py-1 font-mono">{c.name}</td>
                  <td className="px-2 py-1 opacity-80">{c.type || "?"}</td>
                  <td className="px-2 py-1">
                    <div className="flex flex-wrap gap-1 text-[10px]">
                      {c.pk > 0 && <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-200"><KeyRound size={9} /> PK</span>}
                      {c.notnull > 0 && <span className="rounded bg-white/10 px-1.5 py-0.5">NOT NULL</span>}
                      {c.dflt_value !== null && c.dflt_value !== undefined && (
                        <span className="rounded bg-white/10 px-1.5 py-0.5">DEFAULT {String(c.dflt_value)}</span>
                      )}
                      {fk && <span className="inline-flex items-center gap-0.5 rounded bg-sky-500/20 px-1.5 py-0.5 text-sky-200"><Link2 size={9} /> → {fk.table}({fk.to})</span>}
                    </div>
                  </td>
                  <td className="px-2 py-1 text-right">
                    <button onClick={() => onDropColumn(c.name)} className="opacity-40 hover:opacity-100" title="Drop column">
                      <Trash2 size={11} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAddCol && (
        <AddColumnForm onCancel={() => setShowAddCol(false)}
          onAdd={(c) => { onAddColumn(c); setShowAddCol(false); }} />
      )}

      {insertOpen && (
        <InsertRowForm columns={table.columns} onCancel={() => setInsertOpen(false)} onInsert={insertRow} />
      )}

      <div className="rounded-md border border-white/10">
        <div className="border-b border-white/10 px-2 py-1 text-[11px] opacity-70">Data preview (first 200)</div>
        {error && <div className="bg-red-500/15 px-2 py-1 text-[11px] text-red-200">{error}</div>}
        {rows.length === 0 && !error && (
          <div className="px-2 py-3 text-[11px] opacity-60">No rows yet.</div>
        )}
        {rows.length > 0 && (
          <div className="overflow-auto">
            <table className="w-full text-[11px]">
              <thead className="bg-white/5">
                <tr>{cols.map((c) => <th key={c} className="px-2 py-1.5 text-left font-semibold">{c}</th>)}<th /></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-white/5">
                    {r.map((cell, ci) => (
                      <td key={ci} className="px-2 py-1 font-mono align-top">
                        {cell === null ? <span className="opacity-50">NULL</span> : String(cell)}
                      </td>
                    ))}
                    <td className="px-1 py-1 text-right">
                      <button onClick={() => deleteRow(i)} className="opacity-40 hover:opacity-100" title="Delete row"><Trash2 size={11} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AddColumnForm({ onCancel, onAdd }: { onCancel: () => void; onAdd: (c: ColDraft) => void }) {
  const [c, setC] = useState<ColDraft>({
    name: "", type: "TEXT", pk: false, notNull: false, unique: false, defaultValue: "", references: "",
  });
  return (
    <div className="grid gap-2 rounded-md border border-white/10 p-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Input className="h-8 text-xs" placeholder="column name" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
        <Select value={c.type} onValueChange={(v) => setC({ ...c, type: v as SqlType })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{SQL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Input className="h-8 text-xs" placeholder="default" value={c.defaultValue} onChange={(e) => setC({ ...c, defaultValue: e.target.value })} />
        <Input className="h-8 text-xs" placeholder="references table(col)" value={c.references} onChange={(e) => setC({ ...c, references: e.target.value })} />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[11px]">
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={c.notNull} onChange={(e) => setC({ ...c, notNull: e.target.checked })} /> NOT NULL</label>
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={c.unique} onChange={(e) => setC({ ...c, unique: e.target.checked })} /> UNIQUE</label>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={onCancel}>Cancel</Button>
          <Button size="sm" className="h-7 text-[11px]" onClick={() => { if (!c.name.trim()) return toast.error("Name required"); onAdd(c); }}>Add column</Button>
        </div>
      </div>
    </div>
  );
}

function InsertRowForm({ columns, onCancel, onInsert }: {
  columns: TableInfo["columns"]; onCancel: () => void; onInsert: (v: Record<string, string>) => void;
}) {
  const [vals, setVals] = useState<Record<string, string>>({});
  return (
    <div className="grid gap-2 rounded-md border border-white/10 p-2">
      <div className="grid gap-1.5">
        {columns.map((c) => (
          <div key={c.name} className="flex items-center gap-2">
            <label className="w-32 shrink-0 truncate text-[11px]">
              <span className="font-mono">{c.name}</span>
              <span className="ml-1 opacity-50">{c.type}{c.pk ? " · PK" : ""}{c.notnull ? " · NN" : ""}</span>
            </label>
            <Input className="h-8 flex-1 text-xs" placeholder={c.dflt_value !== null && c.dflt_value !== undefined ? `default: ${String(c.dflt_value)}` : "value"}
              value={vals[c.name] ?? ""} onChange={(e) => setVals((s) => ({ ...s, [c.name]: e.target.value }))} />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={onCancel}>Cancel</Button>
        <Button size="sm" className="h-7 text-[11px]" onClick={() => onInsert(vals)}>Insert row</Button>
      </div>
    </div>
  );
}

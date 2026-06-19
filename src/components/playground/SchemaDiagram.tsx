// SVG schema diagram: tables as boxes, foreign keys as arrows. Layout is a
// simple grid (deterministic, no physics) so it stays predictable on phones.
import type { JSX } from "react";

export interface DiagramColumn {
  name: string;
  type: string;
  pk: boolean;
  notnull: boolean;
}
export interface DiagramFk {
  from: string;
  table: string; // referenced table
  to: string;    // referenced column
}
export interface DiagramTable {
  name: string;
  columns: DiagramColumn[];
  fks: DiagramFk[];
}

const CARD_W = 200;
const ROW_H = 18;
const HEADER_H = 26;
const COL_GAP = 60;
const ROW_GAP = 40;

interface Box { name: string; x: number; y: number; w: number; h: number; cols: DiagramColumn[]; fks: DiagramFk[] }

function layout(tables: DiagramTable[]): { boxes: Box[]; w: number; h: number } {
  const cols = Math.max(1, Math.ceil(Math.sqrt(tables.length)));
  const boxes: Box[] = [];
  let maxRowH = 0;
  let curX = 16, curY = 16, colIdx = 0;
  for (const t of tables) {
    const h = HEADER_H + Math.max(1, t.columns.length) * ROW_H + 8;
    boxes.push({ name: t.name, x: curX, y: curY, w: CARD_W, h, cols: t.columns, fks: t.fks });
    maxRowH = Math.max(maxRowH, h);
    colIdx++;
    if (colIdx >= cols) {
      colIdx = 0; curX = 16; curY += maxRowH + ROW_GAP; maxRowH = 0;
    } else {
      curX += CARD_W + COL_GAP;
    }
  }
  const w = 16 + cols * CARD_W + (cols - 1) * COL_GAP + 16;
  const h = curY + maxRowH + 24;
  return { boxes, w, h };
}

export function SchemaDiagram({ tables }: { tables: DiagramTable[] }): JSX.Element {
  if (tables.length === 0) {
    return <div className="grid h-full place-items-center p-4 text-[11px] opacity-60">No tables yet.</div>;
  }
  const { boxes, w, h } = layout(tables);
  const byName = new Map(boxes.map((b) => [b.name, b]));

  function colY(box: Box, colName: string): number {
    const i = box.cols.findIndex((c) => c.name === colName);
    return box.y + HEADER_H + (i < 0 ? 0 : i) * ROW_H + ROW_H / 2;
  }

  const edges = boxes.flatMap((b) =>
    b.fks.map((fk) => {
      const dst = byName.get(fk.table); if (!dst) return null;
      const x1 = b.x + (b.x < dst.x ? b.w : 0);
      const y1 = colY(b, fk.from);
      const x2 = dst.x + (b.x < dst.x ? 0 : dst.w);
      const y2 = colY(dst, fk.to);
      const dx = (x2 - x1) * 0.5;
      const path = `M ${x1} ${y1} C ${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`;
      return { key: `${b.name}.${fk.from}->${dst.name}.${fk.to}`, path, x2, y2 };
    }).filter((e): e is NonNullable<typeof e> => e !== null),
  );

  return (
    <div className="h-full w-full overflow-auto p-2">
      <svg width={w} height={h} className="block">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="currentColor" className="text-sky-400" />
          </marker>
        </defs>
        {edges.map((e) => (
          <path key={e.key} d={e.path} fill="none" strokeWidth={1.4}
            className="text-sky-400/70" stroke="currentColor" markerEnd="url(#arrow)" />
        ))}
        {boxes.map((b) => (
          <g key={b.name} transform={`translate(${b.x},${b.y})`}>
            <rect width={b.w} height={b.h} rx={8} className="fill-white/5 stroke-white/15" strokeWidth={1} />
            <rect width={b.w} height={HEADER_H} rx={8}
              className="fill-sky-500/20 stroke-white/10" strokeWidth={1} />
            <text x={10} y={HEADER_H - 9} className="fill-white text-[12px] font-semibold">{b.name}</text>
            {b.cols.map((c, i) => (
              <g key={c.name} transform={`translate(0,${HEADER_H + i * ROW_H})`}>
                <text x={10} y={ROW_H - 5} className="fill-white/80 text-[10.5px] font-mono">
                  {c.pk ? "★ " : ""}{c.name}
                </text>
                <text x={b.w - 10} y={ROW_H - 5} textAnchor="end" className="fill-white/40 text-[10px]">
                  {c.type}
                </text>
              </g>
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}

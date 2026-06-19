// Lightweight SVG dependency graph — no external lib. ~200 LOC.
import { useMemo } from "react";
import type { Graph, Edge } from "@/lib/playground/relations";

interface Props {
  graph: Graph;
  palette: { bg: string; panel: string; border: string; text: string; subtle: string };
  onSelect?: (path: string) => void;
}

interface NodePos { id: string; x: number; y: number; kind: NodeKind }
type NodeKind = "html" | "css" | "js" | "asset" | "sql" | "mobile" | "other";

const KIND_COLOR: Record<NodeKind, string> = {
  html: "#e34c26", css: "#2965f1", js: "#f7df1e", asset: "#7e5bff",
  sql: "#00758f", mobile: "#3DDC84", other: "#94a3b8",
};

function kindOf(p: string): NodeKind {
  const e = p.toLowerCase().split(".").pop() ?? "";
  if (e === "html" || e === "htm") return "html";
  if (e === "css") return "css";
  if (["js", "ts", "jsx", "tsx", "mjs"].includes(e)) return "js";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "pdf", "mp3", "mp4", "wav", "json"].includes(e)) return "asset";
  if (e === "sql") return "sql";
  if (["kt", "java", "swift", "dart"].includes(e)) return "mobile";
  return "other";
}

export function DepGraph({ graph, palette, onSelect }: Props) {
  const layout = useMemo(() => layoutNodes(graph), [graph]);
  if (graph.nodes.length === 0) {
    return <div className="grid h-full place-items-center text-xs" style={{ color: palette.subtle }}>No files yet.</div>;
  }
  const W = 720, H = 420;
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  return (
    <div className="h-full overflow-auto p-2" style={{ background: palette.bg }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        {/* edges */}
        {layout.edges.map((e, i) => {
          const a = byId.get(e.from); const b = byId.get(e.to);
          if (!a || !b) return null;
          const broken = !e.resolved;
          return (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={broken ? "#ef4444" : palette.border}
              strokeWidth={broken ? 1.4 : 1}
              strokeDasharray={broken ? "4 3" : undefined} />
          );
        })}
        {/* nodes */}
        {layout.nodes.map((n) => (
          <g key={n.id} className="cursor-pointer" onClick={() => onSelect?.(n.id)}>
            <circle cx={n.x} cy={n.y} r={8} fill={KIND_COLOR[n.kind]} stroke={palette.panel} strokeWidth={2} />
            <text x={n.x + 12} y={n.y + 4} fontSize="10" fill={palette.text}>{shortLabel(n.id)}</text>
          </g>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-2 text-[10px]" style={{ color: palette.subtle }}>
        {(Object.keys(KIND_COLOR) as NodeKind[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: KIND_COLOR[k] }} /> {k}
          </span>
        ))}
        {graph.broken.length > 0 && (
          <span className="ml-2 inline-flex items-center gap-1 text-red-400">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" /> {graph.broken.length} broken
          </span>
        )}
      </div>
    </div>
  );
}

function shortLabel(p: string): string {
  if (p.length <= 28) return p;
  const parts = p.split("/");
  return parts.length > 1 ? `…/${parts.slice(-2).join("/")}` : p.slice(-28);
}

function layoutNodes(graph: Graph): { nodes: NodePos[]; edges: Edge[] } {
  const W = 720, H = 420, pad = 32;
  // group nodes by kind into columns
  const buckets: Record<NodeKind, string[]> = { html: [], css: [], js: [], asset: [], sql: [], mobile: [], other: [] };
  for (const p of graph.nodes) buckets[kindOf(p)].push(p);
  const cols = (Object.keys(buckets) as NodeKind[]).filter((k) => buckets[k].length > 0);
  const colW = (W - pad * 2) / Math.max(1, cols.length);
  const nodes: NodePos[] = [];
  cols.forEach((k, ci) => {
    const arr = buckets[k];
    const rowH = (H - pad * 2) / Math.max(1, arr.length);
    arr.forEach((p, ri) => {
      nodes.push({
        id: p, kind: k,
        x: pad + colW * ci + colW / 2,
        y: pad + rowH * ri + rowH / 2,
      });
    });
  });
  return { nodes, edges: graph.edges };
}

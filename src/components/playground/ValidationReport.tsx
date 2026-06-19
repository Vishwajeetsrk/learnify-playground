// Project validation report — surfaces broken refs from the relation engine.
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Graph } from "@/lib/playground/relations";

interface Props {
  graph: Graph;
  palette: { bg: string; panel: string; border: string; text: string; subtle: string };
  onOpenFile?: (path: string) => void;
}

export function ValidationReport({ graph, palette, onOpenFile }: Props) {
  const broken = graph.broken;
  const total = graph.edges.length;
  return (
    <div className="flex h-full flex-col" style={{ color: palette.text }}>
      <div className="flex items-center gap-2 border-b p-3" style={{ borderColor: palette.border }}>
        {broken.length === 0 ? (
          <>
            <CheckCircle2 size={16} className="text-emerald-400" />
            <div className="text-sm font-semibold">All good</div>
            <div className="text-xs" style={{ color: palette.subtle }}>
              {total} reference{total === 1 ? "" : "s"} checked, no broken links.
            </div>
          </>
        ) : (
          <>
            <AlertTriangle size={16} className="text-amber-400" />
            <div className="text-sm font-semibold">{broken.length} problem{broken.length === 1 ? "" : "s"}</div>
            <div className="text-xs" style={{ color: palette.subtle }}>out of {total} references</div>
          </>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        {broken.length === 0 ? (
          <div className="grid place-items-center p-8 text-xs" style={{ color: palette.subtle }}>
            Nothing to fix. Your HTML, CSS, JS, and assets are all wired up.
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: palette.border }}>
            {broken.map((e, i) => (
              <li key={i} className="flex items-start gap-3 p-3 hover:bg-white/5">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">
                    <button className="hover:underline" onClick={() => onOpenFile?.(e.from)}>{e.from}</button>
                    <span className="opacity-50"> · {e.kind}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[11px]" style={{ color: palette.subtle }}>
                    Missing: <code className="rounded bg-black/30 px-1">{e.raw}</code>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

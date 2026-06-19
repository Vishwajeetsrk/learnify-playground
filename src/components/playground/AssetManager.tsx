// Asset Manager — categorized grid view over the project's `asset` files.
// Re-uses the upload pipeline from the parent IDE; this is a richer UI layer.
import { useMemo, useState } from "react";
import { Copy, Trash2, Upload, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export interface AssetFile {
  id: string; path: string; name: string;
  asset?: { mime: string; dataUrl: string; size: number };
}

interface Props {
  files: AssetFile[];
  palette: { bg: string; panel: string; border: string; text: string; subtle: string };
  onUpload: (files: FileList) => void;
  onDelete: (id: string) => void;
  onInsertPath?: (path: string) => void;
}

type Bucket = "images" | "audio" | "video" | "pdfs" | "icons" | "data" | "other";

function bucketOf(a: AssetFile): Bucket {
  const m = a.asset?.mime ?? "";
  const e = a.path.toLowerCase().split(".").pop() ?? "";
  if (m.startsWith("image/")) return e === "svg" ? "icons" : "images";
  if (m.startsWith("audio/")) return "audio";
  if (m.startsWith("video/")) return "video";
  if (m === "application/pdf" || e === "pdf") return "pdfs";
  if (["json", "csv", "yaml", "yml", "xml", "txt", "md"].includes(e)) return "data";
  return "other";
}

const BUCKETS: { key: Bucket; label: string }[] = [
  { key: "images", label: "Images" },
  { key: "icons",  label: "Icons (SVG)" },
  { key: "audio",  label: "Audio" },
  { key: "video",  label: "Video" },
  { key: "pdfs",   label: "PDFs" },
  { key: "data",   label: "Data" },
  { key: "other",  label: "Other" },
];

function fmtSize(n?: number): string {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function AssetManager({ files, palette, onUpload, onDelete, onInsertPath }: Props) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Bucket | "all">("all");
  const assets = useMemo(() => files.filter((f) => f.asset), [files]);
  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (active !== "all" && bucketOf(a) !== active) return false;
      if (q && !a.path.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [assets, q, active]);
  const counts = useMemo(() => {
    const m: Record<string, number> = { all: assets.length };
    for (const b of BUCKETS) m[b.key] = 0;
    for (const a of assets) m[bucketOf(a)] = (m[bucketOf(a)] ?? 0) + 1;
    return m;
  }, [assets]);

  function copyPath(p: string) {
    try { navigator.clipboard.writeText(p); toast.success("Path copied"); } catch { toast.error("Copy failed"); }
  }

  return (
    <div className="flex h-full flex-col" style={{ color: palette.text }}>
      <div className="flex flex-wrap items-center gap-2 border-b p-3" style={{ borderColor: palette.border }}>
        <label className="inline-flex">
          <input type="file" multiple className="hidden"
            onChange={(e) => { if (e.target.files) onUpload(e.target.files); e.target.value = ""; }} />
          <span className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-3 text-xs font-medium"
            style={{ background: "linear-gradient(160deg,#4f8cff,#7e5bff)", color: "#fff" }}>
            <Upload size={12} /> Upload
          </span>
        </label>
        <div className="relative flex-1 min-w-[160px]">
          <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 opacity-50" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search assets…" className="h-8 pl-7 text-xs" />
        </div>
      </div>
      <div className="flex flex-wrap gap-1 border-b px-3 py-2" style={{ borderColor: palette.border }}>
        <button onClick={() => setActive("all")} className="rounded-md px-2 py-1 text-[11px]"
          style={{ background: active === "all" ? palette.panel : "transparent", border: `1px solid ${palette.border}` }}>
          All ({counts.all ?? 0})
        </button>
        {BUCKETS.map((b) => (
          <button key={b.key} onClick={() => setActive(b.key)} className="rounded-md px-2 py-1 text-[11px]"
            style={{ background: active === b.key ? palette.panel : "transparent", border: `1px solid ${palette.border}` }}>
            {b.label} ({counts[b.key] ?? 0})
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-3">
        {filtered.length === 0 ? (
          <div className="grid place-items-center pt-10 text-xs" style={{ color: palette.subtle }}>
            No assets. Drop files or click Upload.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {filtered.map((a) => {
              const b = bucketOf(a);
              return (
                <div key={a.id} className="overflow-hidden rounded-lg border" style={{ borderColor: palette.border, background: palette.panel }}>
                  <div className="grid h-24 place-items-center" style={{ background: palette.bg }}>
                    {b === "images" || b === "icons" ? (
                      <img src={a.asset!.dataUrl} alt={a.name} className="max-h-24 max-w-full object-contain" />
                    ) : b === "audio" ? (
                      <audio controls src={a.asset!.dataUrl} className="w-full px-2" />
                    ) : b === "video" ? (
                      <video src={a.asset!.dataUrl} className="max-h-24" />
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider opacity-60">{a.path.split(".").pop()}</span>
                    )}
                  </div>
                  <div className="p-2">
                    <div className="truncate text-[11px] font-medium" title={a.path}>{a.name}</div>
                    <div className="mt-0.5 text-[10px]" style={{ color: palette.subtle }}>{fmtSize(a.asset!.size)}</div>
                    <div className="mt-1 flex gap-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6" title="Copy path" onClick={() => copyPath(a.path)}>
                        <Copy size={11} />
                      </Button>
                      {onInsertPath && (
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => onInsertPath(a.path)}>
                          Insert
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="ml-auto h-6 w-6 text-red-400" title="Delete" onClick={() => onDelete(a.id)}>
                        <Trash2 size={11} />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

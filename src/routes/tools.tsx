import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Download, FileImage, FileJson, Hash, Scan, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/tools")({
  head: () => ({
    meta: [
      { title: "Free Tools · Playground" },
      { name: "description", content: "Free utilities: image compression, JSON/CSV conversion, base64, and text extraction." },
    ],
  }),
  component: ToolsPage,
});

function ToolsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Free Tools</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Runnable utilities · all client-side · no uploads leave your browser.
        </p>
      </header>
      <div className="grid gap-6 md:grid-cols-2">
        <ImageCompressor />
        <JsonCsvConverter />
        <Base64Tool />
        <TextExtractor />
      </div>
    </div>
  );
}

function Card({ icon: Icon, title, desc, children }: { icon: typeof FileImage; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/30 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold leading-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function ImageCompressor() {
  const [busy, setBusy] = useState(false);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [outSize, setOutSize] = useState(0);
  const [origSize, setOrigSize] = useState(0);
  const [quality, setQuality] = useState(0.7);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(f: File) {
    setBusy(true);
    setOrigSize(f.size);
    try {
      const bmp = await createImageBitmap(f);
      const canvas = document.createElement("canvas");
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0);
      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error("Failed"))), "image/jpeg", quality),
      );
      setOutSize(blob.size);
      setOutUrl(URL.createObjectURL(blob));
      toast.success(`Compressed by ${Math.round((1 - blob.size / f.size) * 100)}%`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card icon={FileImage} title="Image compressor" desc="Re-encode PNG/JPEG to JPEG with adjustable quality.">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <div className="flex items-center gap-2 text-xs">
        <label className="text-muted-foreground">Quality</label>
        <input
          type="range"
          min={10}
          max={100}
          value={quality * 100}
          onChange={(e) => setQuality(Number(e.target.value) / 100)}
          className="flex-1"
        />
        <span className="w-8 text-right tabular-nums">{Math.round(quality * 100)}</span>
      </div>
      <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
        <Upload className="mr-1 h-4 w-4" /> Choose image
      </Button>
      {outUrl && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            {(origSize / 1024).toFixed(1)}KB → {(outSize / 1024).toFixed(1)}KB
          </span>
          <a href={outUrl} download="compressed.jpg" className="ml-auto inline-flex items-center gap-1 text-primary hover:underline">
            <Download className="h-3.5 w-3.5" /> Download
          </a>
        </div>
      )}
    </Card>
  );
}

function JsonCsvConverter() {
  const [input, setInput] = useState('[{"name":"Alice","age":30},{"name":"Bob","age":25}]');
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<"json2csv" | "csv2json">("json2csv");

  function convert() {
    try {
      if (mode === "json2csv") {
        const arr = JSON.parse(input);
        if (!Array.isArray(arr) || arr.length === 0) throw new Error("Expected non-empty array");
        const keys = Array.from(new Set(arr.flatMap((o) => Object.keys(o))));
        const rows = [keys.join(",")];
        for (const o of arr) {
          rows.push(keys.map((k) => JSON.stringify(o[k] ?? "")).join(","));
        }
        setOutput(rows.join("\n"));
      } else {
        const lines = input.trim().split(/\r?\n/);
        const headers = lines[0].split(",").map((s) => s.trim());
        const out = lines.slice(1).map((line) => {
          const cells = line.split(",");
          return Object.fromEntries(headers.map((h, i) => [h, cells[i]?.trim() ?? ""]));
        });
        setOutput(JSON.stringify(out, null, 2));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <Card icon={FileJson} title="JSON ↔ CSV converter" desc="Convert between JSON arrays of objects and CSV.">
      <div className="flex gap-2 text-xs">
        <button
          onClick={() => setMode("json2csv")}
          className={`rounded border px-2 py-0.5 ${mode === "json2csv" ? "border-primary bg-primary/10 text-primary" : "border-border/60"}`}
        >
          JSON → CSV
        </button>
        <button
          onClick={() => setMode("csv2json")}
          className={`rounded border px-2 py-0.5 ${mode === "csv2json" ? "border-primary bg-primary/10 text-primary" : "border-border/60"}`}
        >
          CSV → JSON
        </button>
      </div>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="h-24 resize-y rounded-md border border-input bg-background p-2 font-mono text-xs"
      />
      <Button size="sm" onClick={convert}>
        Convert
      </Button>
      {output && (
        <textarea
          readOnly
          value={output}
          className="h-24 resize-y rounded-md border border-input bg-muted/40 p-2 font-mono text-xs"
        />
      )}
    </Card>
  );
}

function Base64Tool() {
  const [text, setText] = useState("Hello, world!");
  const [mode, setMode] = useState<"enc" | "dec">("enc");
  const [out, setOut] = useState("");

  function run() {
    try {
      setOut(mode === "enc" ? btoa(unescape(encodeURIComponent(text))) : decodeURIComponent(escape(atob(text))));
    } catch (e) {
      toast.error("Invalid input");
    }
  }

  return (
    <Card icon={Hash} title="Base64 encode / decode" desc="Quick conversion for tokens, payloads, or data URIs.">
      <div className="flex gap-2 text-xs">
        <button
          onClick={() => setMode("enc")}
          className={`rounded border px-2 py-0.5 ${mode === "enc" ? "border-primary bg-primary/10 text-primary" : "border-border/60"}`}
        >
          Encode
        </button>
        <button
          onClick={() => setMode("dec")}
          className={`rounded border px-2 py-0.5 ${mode === "dec" ? "border-primary bg-primary/10 text-primary" : "border-border/60"}`}
        >
          Decode
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="h-20 resize-y rounded-md border border-input bg-background p-2 font-mono text-xs"
      />
      <Button size="sm" onClick={run}>
        Run
      </Button>
      {out && (
        <textarea
          readOnly
          value={out}
          className="h-20 resize-y rounded-md border border-input bg-muted/40 p-2 font-mono text-xs"
        />
      )}
    </Card>
  );
}

function TextExtractor() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ emails: string[]; urls: string[]; numbers: string[] } | null>(null);

  function run() {
    const emails = Array.from(new Set(text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? []));
    const urls = Array.from(new Set(text.match(/https?:\/\/[^\s)]+/g) ?? []));
    const numbers = Array.from(new Set(text.match(/-?\d+(?:\.\d+)?/g) ?? []));
    setResult({ emails, urls, numbers });
  }

  return (
    <Card icon={Scan} title="Text extractor" desc="Extract emails, URLs, and numbers from any text.">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste text…"
        className="h-24 resize-y rounded-md border border-input bg-background p-2 font-mono text-xs"
      />
      <Button size="sm" onClick={run}>
        Extract
      </Button>
      {result && (
        <div className="grid gap-1 text-xs">
          {(["emails", "urls", "numbers"] as const).map((k) => (
            <details key={k} className="rounded border border-border/60 bg-background p-2">
              <summary className="cursor-pointer font-medium capitalize">
                {k} ({result[k].length})
              </summary>
              <pre className="mt-1 max-h-24 overflow-auto text-muted-foreground">{result[k].join("\n") || "—"}</pre>
            </details>
          ))}
        </div>
      )}
    </Card>
  );
}

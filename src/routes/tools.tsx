import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Braces,
  Calculator,
  Clock,
  Code as CodeIcon,
  Download,
  FileImage,
  FileJson,
  Fingerprint,
  Hash,
  KeyRound,
  Link as LinkIcon,
  Palette,
  Scan,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Type,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/tools")({
  head: () => ({
    meta: [
      { title: "Free Tools · Playground" },
      {
        name: "description",
        content:
          "Free in-browser utilities: image compression, JSON/CSV, base64, URL encoder, JWT decoder, UUID, hash, color converter, regex tester, and more.",
      },
    ],
  }),
  component: ToolsPage,
});

function ToolsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-4 sm:py-10">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Free Tools</h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Runnable utilities · all client-side · nothing leaves your browser.
        </p>
      </header>
      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <ImageCompressor />
        <JsonCsvConverter />
        <Base64Tool />
        <UrlEncoder />
        <JwtDecoder />
        <UuidGenerator />
        <HashGenerator />
        <PasswordGenerator />
        <ColorConverter />
        <RegexTester />
        <TextExtractor />
        <CaseConverter />
        <SlugifyTool />
        <TimestampConverter />
        <WordCounter />
      </div>
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: typeof FileImage;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-lg border border-border/60 bg-card/30 p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-tight sm:text-base">{title}</h2>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded border px-2 py-0.5 transition ${
            value === o.value
              ? "border-primary bg-primary/10 text-primary"
              : "border-border/60 hover:border-border"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function copy(text: string) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(
    () => toast.success("Copied"),
    () => toast.error("Copy failed"),
  );
}

/* ---------- Image compressor ---------- */
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
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            {(origSize / 1024).toFixed(1)}KB → {(outSize / 1024).toFixed(1)}KB
          </span>
          <a
            href={outUrl}
            download="compressed.jpg"
            className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </a>
        </div>
      )}
    </Card>
  );
}

/* ---------- JSON ↔ CSV ---------- */
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
        for (const o of arr) rows.push(keys.map((k) => JSON.stringify(o[k] ?? "")).join(","));
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
    <Card icon={FileJson} title="JSON ↔ CSV" desc="Convert between JSON arrays of objects and CSV.">
      <Tabs
        value={mode}
        onChange={setMode}
        options={[
          { value: "json2csv", label: "JSON → CSV" },
          { value: "csv2json", label: "CSV → JSON" },
        ]}
      />
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="h-24 resize-y rounded-md border border-input bg-background p-2 font-mono text-xs"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={convert}>
          Convert
        </Button>
        {output && (
          <Button size="sm" variant="outline" onClick={() => copy(output)}>
            Copy
          </Button>
        )}
      </div>
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

/* ---------- Base64 ---------- */
function Base64Tool() {
  const [text, setText] = useState("Hello, world!");
  const [mode, setMode] = useState<"enc" | "dec">("enc");
  const [out, setOut] = useState("");

  function run() {
    try {
      setOut(mode === "enc" ? btoa(unescape(encodeURIComponent(text))) : decodeURIComponent(escape(atob(text))));
    } catch {
      toast.error("Invalid input");
    }
  }

  return (
    <Card icon={Hash} title="Base64" desc="Encode or decode text using base64.">
      <Tabs
        value={mode}
        onChange={setMode}
        options={[
          { value: "enc", label: "Encode" },
          { value: "dec", label: "Decode" },
        ]}
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="h-20 resize-y rounded-md border border-input bg-background p-2 font-mono text-xs"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={run}>
          Run
        </Button>
        {out && (
          <Button size="sm" variant="outline" onClick={() => copy(out)}>
            Copy
          </Button>
        )}
      </div>
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

/* ---------- URL encode/decode ---------- */
function UrlEncoder() {
  const [text, setText] = useState("https://example.com/?q=hello world&x=1");
  const [mode, setMode] = useState<"enc" | "dec">("enc");
  const [out, setOut] = useState("");
  function run() {
    try {
      setOut(mode === "enc" ? encodeURIComponent(text) : decodeURIComponent(text));
    } catch {
      toast.error("Invalid input");
    }
  }
  return (
    <Card icon={LinkIcon} title="URL encoder" desc="Percent-encode or decode URLs and query strings.">
      <Tabs
        value={mode}
        onChange={setMode}
        options={[
          { value: "enc", label: "Encode" },
          { value: "dec", label: "Decode" },
        ]}
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="h-20 resize-y rounded-md border border-input bg-background p-2 font-mono text-xs"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={run}>
          Run
        </Button>
        {out && (
          <Button size="sm" variant="outline" onClick={() => copy(out)}>
            Copy
          </Button>
        )}
      </div>
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

/* ---------- JWT decoder ---------- */
function JwtDecoder() {
  const [token, setToken] = useState("");
  const decoded = useMemo(() => {
    if (!token.trim()) return null;
    const parts = token.trim().split(".");
    if (parts.length < 2) return { error: "Not a JWT (need at least header.payload)" };
    try {
      const dec = (s: string) => {
        const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
        const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
        return JSON.parse(decodeURIComponent(escape(atob(b64))));
      };
      return { header: dec(parts[0]), payload: dec(parts[1]) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Decode failed" };
    }
  }, [token]);

  return (
    <Card icon={ShieldCheck} title="JWT decoder" desc="Inspect header and payload of a JSON Web Token (no signature check).">
      <textarea
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Paste a JWT…"
        className="h-20 resize-y rounded-md border border-input bg-background p-2 font-mono text-xs"
      />
      {decoded && "error" in decoded && (
        <p className="text-xs text-destructive">{decoded.error}</p>
      )}
      {decoded && "payload" in decoded && (
        <div className="grid gap-2 text-xs">
          <div>
            <div className="mb-1 font-medium text-muted-foreground">Header</div>
            <pre className="overflow-auto rounded border border-border/60 bg-background p-2 font-mono">
              {JSON.stringify(decoded.header, null, 2)}
            </pre>
          </div>
          <div>
            <div className="mb-1 font-medium text-muted-foreground">Payload</div>
            <pre className="overflow-auto rounded border border-border/60 bg-background p-2 font-mono">
              {JSON.stringify(decoded.payload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------- UUID generator ---------- */
function UuidGenerator() {
  const [count, setCount] = useState(5);
  const [ids, setIds] = useState<string[]>([]);
  function gen() {
    const out: string[] = [];
    for (let i = 0; i < count; i++) out.push(crypto.randomUUID());
    setIds(out);
  }
  useEffect(gen, []); // initial
  return (
    <Card icon={Fingerprint} title="UUID generator" desc="Generate v4 UUIDs using the browser's crypto API.">
      <div className="flex items-center gap-2 text-xs">
        <label className="text-muted-foreground">Count</label>
        <input
          type="number"
          min={1}
          max={100}
          value={count}
          onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
          className="h-7 w-20 rounded border border-input bg-background px-2"
        />
        <Button size="sm" onClick={gen} className="ml-auto">
          Generate
        </Button>
      </div>
      {ids.length > 0 && (
        <>
          <pre className="max-h-32 overflow-auto rounded border border-border/60 bg-background p-2 font-mono text-xs">
            {ids.join("\n")}
          </pre>
          <Button size="sm" variant="outline" onClick={() => copy(ids.join("\n"))}>
            Copy all
          </Button>
        </>
      )}
    </Card>
  );
}

/* ---------- SHA hash ---------- */
function HashGenerator() {
  const [text, setText] = useState("hello world");
  const [algo, setAlgo] = useState<"SHA-1" | "SHA-256" | "SHA-384" | "SHA-512">("SHA-256");
  const [out, setOut] = useState("");
  async function run() {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest(algo, enc);
    setOut(
      Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    );
  }
  return (
    <Card icon={KeyRound} title="Hash generator" desc="Compute SHA-1/256/384/512 with the Web Crypto API.">
      <Tabs
        value={algo}
        onChange={setAlgo}
        options={[
          { value: "SHA-1", label: "SHA-1" },
          { value: "SHA-256", label: "SHA-256" },
          { value: "SHA-384", label: "SHA-384" },
          { value: "SHA-512", label: "SHA-512" },
        ]}
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="h-16 resize-y rounded-md border border-input bg-background p-2 font-mono text-xs"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={run}>
          Hash
        </Button>
        {out && (
          <Button size="sm" variant="outline" onClick={() => copy(out)}>
            Copy
          </Button>
        )}
      </div>
      {out && (
        <pre className="overflow-auto break-all rounded border border-border/60 bg-muted/40 p-2 font-mono text-xs">
          {out}
        </pre>
      )}
    </Card>
  );
}

/* ---------- Password generator ---------- */
function PasswordGenerator() {
  const [len, setLen] = useState(20);
  const [opts, setOpts] = useState({ upper: true, lower: true, digits: true, symbols: true });
  const [out, setOut] = useState("");
  function gen() {
    const sets: string[] = [];
    if (opts.lower) sets.push("abcdefghijklmnopqrstuvwxyz");
    if (opts.upper) sets.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    if (opts.digits) sets.push("0123456789");
    if (opts.symbols) sets.push("!@#$%^&*()-_=+[]{}<>?/");
    if (sets.length === 0) {
      toast.error("Pick at least one character set");
      return;
    }
    const all = sets.join("");
    const buf = new Uint32Array(len);
    crypto.getRandomValues(buf);
    let s = "";
    for (let i = 0; i < len; i++) s += all[buf[i] % all.length];
    setOut(s);
  }
  useEffect(gen, []); // initial
  return (
    <Card icon={Sparkles} title="Password generator" desc="Cryptographically random passwords with adjustable length.">
      <div className="flex items-center gap-2 text-xs">
        <label className="text-muted-foreground">Length</label>
        <input
          type="range"
          min={6}
          max={64}
          value={len}
          onChange={(e) => setLen(Number(e.target.value))}
          className="flex-1"
        />
        <span className="w-6 text-right tabular-nums">{len}</span>
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        {(["upper", "lower", "digits", "symbols"] as const).map((k) => (
          <label key={k} className="flex items-center gap-1 capitalize">
            <input
              type="checkbox"
              checked={opts[k]}
              onChange={(e) => setOpts({ ...opts, [k]: e.target.checked })}
            />
            {k}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={gen}>
          Generate
        </Button>
        {out && (
          <Button size="sm" variant="outline" onClick={() => copy(out)}>
            Copy
          </Button>
        )}
      </div>
      {out && (
        <pre className="overflow-auto break-all rounded border border-border/60 bg-muted/40 p-2 font-mono text-xs">
          {out}
        </pre>
      )}
    </Card>
  );
}

/* ---------- Color converter ---------- */
function ColorConverter() {
  const [hex, setHex] = useState("#6366f1");
  const parsed = useMemo(() => {
    const m = /^#?([a-fA-F0-9]{6})$/.exec(hex.trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    // HSL
    const rn = r / 255,
      gn = g / 255,
      bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    let h = 0;
    const l = (max + min) / 2;
    const d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (d !== 0) {
      switch (max) {
        case rn:
          h = ((gn - bn) / d) % 6;
          break;
        case gn:
          h = (bn - rn) / d + 2;
          break;
        case bn:
          h = (rn - gn) / d + 4;
          break;
      }
      h = Math.round(h * 60);
      if (h < 0) h += 360;
    }
    return {
      hex: `#${m[1].toLowerCase()}`,
      rgb: `rgb(${r}, ${g}, ${b})`,
      hsl: `hsl(${h}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`,
      preview: `#${m[1]}`,
    };
  }, [hex]);
  return (
    <Card icon={Palette} title="Color converter" desc="Convert between HEX, RGB, and HSL.">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={parsed?.hex ?? "#6366f1"}
          onChange={(e) => setHex(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-input bg-background"
        />
        <input
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          className="h-9 flex-1 rounded border border-input bg-background px-2 font-mono text-xs"
        />
      </div>
      {parsed ? (
        <div className="grid gap-1 text-xs">
          {(["hex", "rgb", "hsl"] as const).map((k) => (
            <button
              key={k}
              onClick={() => copy(parsed[k] ?? "")}
              className="flex items-center justify-between rounded border border-border/60 bg-background px-2 py-1 text-left font-mono hover:border-primary"
            >
              <span className="uppercase text-muted-foreground">{k}</span>
              <span>{parsed[k] ?? ""}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-destructive">Use a 6-digit hex like #6366f1</p>
      )}
    </Card>
  );
}

/* ---------- Regex tester ---------- */
function RegexTester() {
  const [pattern, setPattern] = useState("\\b\\w+@\\w+\\.\\w+\\b");
  const [flags, setFlags] = useState("g");
  const [input, setInput] = useState("Contact alice@example.com or bob@test.io for info.");
  const result = useMemo(() => {
    try {
      const re = new RegExp(pattern, flags);
      const matches: { match: string; index: number }[] = [];
      if (flags.includes("g")) {
        let m: RegExpExecArray | null;
        while ((m = re.exec(input)) !== null) {
          matches.push({ match: m[0], index: m.index });
          if (m.index === re.lastIndex) re.lastIndex++;
        }
      } else {
        const m = re.exec(input);
        if (m) matches.push({ match: m[0], index: m.index });
      }
      return { matches };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Bad pattern" };
    }
  }, [pattern, flags, input]);

  return (
    <Card icon={CodeIcon} title="Regex tester" desc="Test JavaScript regular expressions with live match highlighting.">
      <div className="flex gap-2">
        <input
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          className="h-8 flex-1 rounded border border-input bg-background px-2 font-mono text-xs"
        />
        <input
          value={flags}
          onChange={(e) => setFlags(e.target.value)}
          placeholder="flags"
          className="h-8 w-20 rounded border border-input bg-background px-2 font-mono text-xs"
        />
      </div>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="h-20 resize-y rounded-md border border-input bg-background p-2 font-mono text-xs"
      />
      {"error" in result ? (
        <p className="text-xs text-destructive">{result.error}</p>
      ) : (
        <div className="text-xs">
          <div className="mb-1 text-muted-foreground">{result.matches.length} matches</div>
          {result.matches.length > 0 && (
            <pre className="max-h-24 overflow-auto rounded border border-border/60 bg-background p-2 font-mono">
              {result.matches.map((m) => `[${m.index}] ${m.match}`).join("\n")}
            </pre>
          )}
        </div>
      )}
    </Card>
  );
}

/* ---------- Text extractor ---------- */
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
    <Card icon={Scan} title="Text extractor" desc="Pull emails, URLs, and numbers out of any text.">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste text…"
        className="h-20 resize-y rounded-md border border-input bg-background p-2 font-mono text-xs"
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

/* ---------- Case converter ---------- */
function CaseConverter() {
  const [text, setText] = useState("Hello world from playground");
  const conversions = useMemo(() => {
    const words = text.split(/[\s_\-]+/).filter(Boolean);
    return {
      UPPER: text.toUpperCase(),
      lower: text.toLowerCase(),
      Title: text.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()),
      camelCase: words.map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join(""),
      PascalCase: words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(""),
      snake_case: words.map((w) => w.toLowerCase()).join("_"),
      "kebab-case": words.map((w) => w.toLowerCase()).join("-"),
    };
  }, [text]);
  return (
    <Card icon={Type} title="Case converter" desc="Convert text between common naming cases.">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="h-16 resize-y rounded-md border border-input bg-background p-2 font-mono text-xs"
      />
      <div className="grid gap-1 text-xs">
        {Object.entries(conversions).map(([k, v]) => (
          <button
            key={k}
            onClick={() => copy(v)}
            className="flex items-center justify-between gap-2 rounded border border-border/60 bg-background px-2 py-1 text-left hover:border-primary"
          >
            <span className="shrink-0 text-muted-foreground">{k}</span>
            <span className="truncate font-mono">{v}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

/* ---------- Slugify ---------- */
function SlugifyTool() {
  const [text, setText] = useState("Hello World! This is My Post #1");
  const slug = useMemo(
    () =>
      text
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80),
    [text],
  );
  return (
    <Card icon={ScrollText} title="Slugify" desc="Turn any title into a URL-safe slug.">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="h-9 rounded border border-input bg-background px-2 text-sm"
      />
      <button
        onClick={() => copy(slug)}
        className="rounded border border-border/60 bg-background px-2 py-1.5 text-left font-mono text-xs hover:border-primary"
      >
        {slug || "—"}
      </button>
    </Card>
  );
}

/* ---------- Timestamp converter ---------- */
function TimestampConverter() {
  const [input, setInput] = useState(String(Math.floor(Date.now() / 1000)));
  const parsed = useMemo(() => {
    const s = input.trim();
    if (!s) return null;
    let d: Date;
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      d = new Date(s.length > 10 ? n : n * 1000);
    } else {
      d = new Date(s);
    }
    if (isNaN(d.getTime())) return { error: "Unrecognized" };
    return {
      iso: d.toISOString(),
      local: d.toLocaleString(),
      unix: String(Math.floor(d.getTime() / 1000)),
      ms: String(d.getTime()),
    };
  }, [input]);
  return (
    <Card icon={Clock} title="Timestamp converter" desc="Convert between Unix timestamps and ISO/local dates.">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Unix or ISO date"
          className="h-9 flex-1 rounded border border-input bg-background px-2 font-mono text-xs"
        />
        <Button size="sm" variant="outline" onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}>
          Now
        </Button>
      </div>
      {parsed && "error" in parsed && <p className="text-xs text-destructive">{parsed.error}</p>}
      {parsed && "iso" in parsed && (
        <div className="grid gap-1 text-xs">
          {(["iso", "local", "unix", "ms"] as const).map((k) => (
            <button
              key={k}
              onClick={() => copy(parsed[k] ?? "")}
              className="flex items-center justify-between gap-2 rounded border border-border/60 bg-background px-2 py-1 text-left hover:border-primary"
            >
              <span className="shrink-0 uppercase text-muted-foreground">{k}</span>
              <span className="truncate font-mono">{parsed[k] ?? ""}</span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ---------- Word counter ---------- */
function WordCounter() {
  const [text, setText] = useState("");
  const stats = useMemo(() => {
    const chars = text.length;
    const charsNoSpace = text.replace(/\s/g, "").length;
    const words = (text.trim().match(/\S+/g) ?? []).length;
    const lines = text === "" ? 0 : text.split(/\r?\n/).length;
    const sentences = (text.match(/[.!?]+(\s|$)/g) ?? []).length;
    return { chars, charsNoSpace, words, lines, sentences };
  }, [text]);
  return (
    <Card icon={Calculator} title="Word counter" desc="Live count of characters, words, lines, and sentences.">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste or type text…"
        className="h-24 resize-y rounded-md border border-input bg-background p-2 text-xs"
      />
      <div className="grid grid-cols-2 gap-1 text-xs sm:grid-cols-3">
        {Object.entries(stats).map(([k, v]) => (
          <div key={k} className="rounded border border-border/60 bg-background px-2 py-1">
            <div className="text-muted-foreground">{k}</div>
            <div className="font-mono text-sm">{v}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Suppress unused import warning for Braces icon — used by a future tool slot.
void Braces;

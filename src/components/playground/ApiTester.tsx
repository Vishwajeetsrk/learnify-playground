// Postman-style HTTP request tester. Sends real fetch() requests in the browser
// and renders status, headers, timing, and body. Persists to localStorage.
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Header { key: string; value: string }
interface ApiState {
  method: string;
  url: string;
  headers: Header[];
  body: string;
  tab: "headers" | "body";
}

interface ApiResponse {
  status: number;
  statusText: string;
  ms: number;
  size: number;
  contentType: string;
  headers: Record<string, string>;
  body: string;
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const KEY = "playground:api-tester:v1";

function loadState(): ApiState {
  try {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch { /* ignore */ }
  return {
    method: "GET",
    url: "https://jsonplaceholder.typicode.com/todos/1",
    headers: [{ key: "Accept", value: "application/json" }],
    body: "",
    tab: "headers",
  };
}

export function ApiTester() {
  const [state, setState] = useState<ApiState>(() => loadState());
  const [sending, setSending] = useState(false);
  const [res, setRes] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  const prettyBody = useMemo(() => {
    if (!res) return "";
    const ct = res.contentType.toLowerCase();
    if (ct.includes("json")) {
      try { return JSON.stringify(JSON.parse(res.body), null, 2); } catch { return res.body; }
    }
    return res.body;
  }, [res]);

  async function send() {
    if (!state.url.trim()) { setError("Enter a URL"); return; }
    setSending(true); setError(null); setRes(null);
    const headers = Object.fromEntries(state.headers.filter((h) => h.key.trim()).map((h) => [h.key, h.value]));
    const init: RequestInit = { method: state.method, headers };
    if (!["GET", "HEAD"].includes(state.method) && state.body.trim()) init.body = state.body;
    const t0 = performance.now();
    try {
      const r = await fetch(state.url, init);
      const text = await r.text();
      const ms = Math.round(performance.now() - t0);
      const allHeaders: Record<string, string> = {};
      r.headers.forEach((v, k) => { allHeaders[k] = v; });
      setRes({
        status: r.status, statusText: r.statusText, ms,
        size: new Blob([text]).size,
        contentType: r.headers.get("content-type") ?? "",
        headers: allHeaders, body: text,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setSending(false); }
  }

  return (
    <div className="flex h-full flex-col text-sm">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 p-2">
        <Select value={state.method} onValueChange={(m) => setState((s) => ({ ...s, method: m }))}>
          <SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          value={state.url}
          onChange={(e) => setState((s) => ({ ...s, url: e.target.value }))}
          placeholder="https://api.example.com/users"
          className="h-9 flex-1 min-w-0"
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
        />
        <Button onClick={send} disabled={sending} className="h-9 shrink-0">
          {sending ? <Loader2 className="mr-1 animate-spin" size={14} /> : <Send className="mr-1" size={14} />}
          Send
        </Button>
      </div>

      <div className="flex shrink-0 gap-1 border-b border-white/10 px-2 pt-2">
        {(["headers", "body"] as const).map((t) => (
          <button key={t} onClick={() => setState((s) => ({ ...s, tab: t }))}
            className={`rounded-t-md px-3 py-1.5 text-xs font-medium ${state.tab === t ? "bg-white/10" : "opacity-60 hover:opacity-100"}`}>
            {t === "headers" ? `Headers (${state.headers.length})` : "Body"}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-2 divide-y divide-white/10">
        <div className="overflow-auto p-2">
          {state.tab === "headers" ? (
            <div className="grid gap-1">
              {state.headers.map((h, i) => (
                <div key={i} className="flex gap-1">
                  <Input className="h-8 flex-1" placeholder="Header" value={h.key}
                    onChange={(e) => setState((s) => ({ ...s, headers: s.headers.map((x, j) => j === i ? { ...x, key: e.target.value } : x) }))} />
                  <Input className="h-8 flex-1" placeholder="Value" value={h.value}
                    onChange={(e) => setState((s) => ({ ...s, headers: s.headers.map((x, j) => j === i ? { ...x, value: e.target.value } : x) }))} />
                  <Button size="icon" variant="ghost" className="h-8 w-8"
                    onClick={() => setState((s) => ({ ...s, headers: s.headers.filter((_, j) => j !== i) }))}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="ghost" className="mt-1 justify-start"
                onClick={() => setState((s) => ({ ...s, headers: [...s.headers, { key: "", value: "" }] }))}>
                <Plus size={14} className="mr-1" /> Add header
              </Button>
            </div>
          ) : (
            <textarea
              value={state.body}
              onChange={(e) => setState((s) => ({ ...s, body: e.target.value }))}
              placeholder='{"name":"Lovable"}'
              className="h-full w-full resize-none rounded-md border border-white/10 bg-black/40 p-2 font-mono text-xs outline-none"
              spellCheck={false}
            />
          )}
        </div>

        <div className="overflow-auto p-2">
          {error && <div className="rounded-md bg-red-500/15 p-2 text-xs text-red-300">{error}</div>}
          {!res && !error && (
            <div className="grid h-full place-items-center text-xs opacity-60">
              Click <span className="mx-1 rounded bg-white/10 px-1.5">Send</span> to make a request.
            </div>
          )}
          {res && (
            <div className="grid gap-2">
              <div className="flex flex-wrap gap-2 text-[11px]">
                <Badge tone={res.status < 300 ? "ok" : res.status < 400 ? "warn" : "err"}>
                  {res.status} {res.statusText}
                </Badge>
                <Badge>{res.ms} ms</Badge>
                <Badge>{(res.size / 1024).toFixed(1)} KB</Badge>
                {res.contentType && <Badge>{res.contentType.split(";")[0]}</Badge>}
              </div>
              <details className="rounded-md border border-white/10 p-2">
                <summary className="cursor-pointer text-[11px] opacity-70">Response headers ({Object.keys(res.headers).length})</summary>
                <pre className="mt-2 overflow-auto text-[11px]">{Object.entries(res.headers).map(([k, v]) => `${k}: ${v}`).join("\n")}</pre>
              </details>
              <pre className="m-0 overflow-auto rounded-md bg-black/60 p-2 font-mono text-[11px] leading-relaxed text-emerald-200">
                {prettyBody || "(empty body)"}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: "ok" | "warn" | "err" }) {
  const c = tone === "ok" ? "bg-emerald-500/20 text-emerald-200"
        : tone === "warn" ? "bg-amber-500/20 text-amber-200"
        : tone === "err" ? "bg-red-500/20 text-red-200"
        : "bg-white/10 text-white/80";
  return <span className={`rounded px-1.5 py-0.5 ${c}`}>{children}</span>;
}

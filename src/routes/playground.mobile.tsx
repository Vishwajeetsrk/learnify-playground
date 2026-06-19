import { createFileRoute } from "@tanstack/react-router";
import Editor from "@monaco-editor/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, RotateCw, Smartphone, Bug, BugOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WebAiDebugPanel } from "@/components/web-ai-debug-panel";

const STARTER_HTML = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  </head>
  <body>
    <header class="bar"><h1>My App</h1></header>
    <main>
      <div class="card">
        <h2>Welcome 👋</h2>
        <p>Tap the button to count.</p>
        <button id="b" class="btn">Tapped 0 times</button>
      </div>
      <ul class="list">
        <li>📦 Inbox</li><li>⭐ Starred</li><li>📅 Today</li><li>⚙️ Settings</li>
      </ul>
    </main>
    <nav class="tabbar">
      <button class="tab active">🏠<span>Home</span></button>
      <button class="tab">🔍<span>Search</span></button>
      <button class="tab">👤<span>Profile</span></button>
    </nav>
  </body>
</html>`;

const STARTER_CSS = `:root { color-scheme: light dark; }
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f4f4f7; color: #111; }
@media (prefers-color-scheme: dark) { html, body { background: #0b0b10; color: #f4f4f7; } .card, .tabbar { background: #15151c !important; } }
.bar { padding: env(safe-area-inset-top) 16px 12px; background: linear-gradient(135deg,#6366f1,#8b5cf6); color: white; }
.bar h1 { margin: 12px 0 0; font-size: 22px; }
main { padding: 16px; padding-bottom: 96px; display: grid; gap: 16px; }
.card { background: white; border-radius: 16px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.btn { width: 100%; padding: 12px 16px; border-radius: 12px; border: 0; background: #6366f1; color: white; font-weight: 600; font-size: 15px; }
.btn:active { transform: scale(.98); }
.list { list-style: none; padding: 0; margin: 0; background: white; border-radius: 16px; overflow: hidden; }
.list li { padding: 14px 16px; border-bottom: 1px solid rgba(0,0,0,.06); font-size: 15px; }
.list li:last-child { border: 0; }
.tabbar { position: fixed; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-around;
  padding: 8px 0 calc(8px + env(safe-area-inset-bottom)); background: white; border-top: 1px solid rgba(0,0,0,.08); }
.tab { background: transparent; border: 0; font-size: 20px; display: flex; flex-direction: column; align-items: center; gap: 2px; color: #888; }
.tab span { font-size: 10px; font-weight: 600; }
.tab.active { color: #6366f1; }`;

const STARTER_JS = `let n = 0;
const b = document.getElementById('b');
b.addEventListener('click', () => { n++; b.textContent = 'Tapped ' + n + ' times'; });`;

function buildErrorBridge(nonce: string) {
  return `<script>
(function(){
  var NONCE = ${JSON.stringify(nonce)};
  var seq = 0;
  function send(t, m){ try { parent.postMessage({ __webpg: true, nonce: NONCE, seq: ++seq, type: t, msg: String(m) }, '*'); } catch(_){} }
  window.addEventListener('error', function(e){ send('error', (e.message || 'Error') + (e.filename ? ' @ ' + e.filename + ':' + e.lineno : '')); });
  window.addEventListener('unhandledrejection', function(e){ var r = e.reason; send('error', 'Unhandled rejection: ' + (r && r.message ? r.message : String(r))); });
  var oe = console.error; console.error = function(){ send('error', Array.from(arguments).map(String).join(' ')); oe.apply(console, arguments); };
})();
<\/script>`;
}

type DeviceKey = "iphone15" | "iphoneSE" | "pixel8" | "galaxyS24" | "ipadMini";
const DEVICES: Record<DeviceKey, { label: string; w: number; h: number; radius: number; notch: boolean }> = {
  iphone15: { label: "iPhone 15", w: 393, h: 852, radius: 48, notch: true },
  iphoneSE: { label: "iPhone SE", w: 375, h: 667, radius: 22, notch: false },
  pixel8: { label: "Pixel 8", w: 412, h: 915, radius: 36, notch: true },
  galaxyS24: { label: "Galaxy S24", w: 384, h: 854, radius: 32, notch: true },
  ipadMini: { label: "iPad mini", w: 744, h: 1133, radius: 24, notch: false },
};

export const Route = createFileRoute("/playground/mobile")({
  head: () => ({
    meta: [
      { title: "Mobile App Playground" },
      { name: "description", content: "Code and preview mobile apps live inside a phone frame — iPhone, Pixel, Galaxy, iPad." },
    ],
  }),
  component: MobilePlayground,
});

function MobilePlayground() {
  const [html, setHtml] = useState(STARTER_HTML);
  const [css, setCss] = useState(STARTER_CSS);
  const [js, setJs] = useState(STARTER_JS);
  const [device, setDevice] = useState<DeviceKey>("iphone15");
  const [landscape, setLandscape] = useState(false);
  const [scale, setScale] = useState(0.75);
  const [autoRun, setAutoRun] = useState(true);
  const [showDebug, setShowDebug] = useState(true);
  const [previewKey, setPreviewKey] = useState(0);
  const [debounced, setDebounced] = useState({ html, css, js });
  const [consoleErrors, setConsoleErrors] = useState("");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  const nonce = useMemo(
    () => Math.random().toString(36).slice(2) + Date.now().toString(36),
    [debounced, previewKey],
  );

  useEffect(() => {
    if (!autoRun) return;
    const t = setTimeout(() => setDebounced({ html, css, js }), 500);
    return () => clearTimeout(t);
  }, [html, css, js, autoRun]);

  useEffect(() => {
    setConsoleErrors("");
    seenRef.current = new Set();
  }, [nonce]);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return;
      const d = e.data as { __webpg?: boolean; nonce?: string; seq?: number; type?: string; msg?: string };
      if (!d || !d.__webpg || d.nonce !== nonce || d.type !== "error" || !d.msg) return;
      const key = `${d.seq}:${d.msg}`;
      if (seenRef.current.has(key)) return;
      seenRef.current.add(key);
      setConsoleErrors((p) => (p ? p + "\n" : "") + d.msg);
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [nonce]);

  const srcDoc = useMemo(
    () => `${debounced.html}\n<style>${debounced.css}</style>\n${buildErrorBridge(nonce)}\n<script>${debounced.js}<\/script>`,
    [debounced, nonce],
  );

  const d = DEVICES[device];
  const baseW = landscape ? d.h : d.w;
  const baseH = landscape ? d.w : d.h;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col lg:h-[calc(100vh-3.5rem)]">
      <h1 className="sr-only">Mobile App Playground</h1>
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-card/40 p-2">
        <Smartphone className="h-4 w-4 text-primary" />
        <Select value={device} onValueChange={(v) => setDevice(v as DeviceKey)}>
          <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(DEVICES) as DeviceKey[]).map((k) => (
              <SelectItem key={k} value={k}>
                {DEVICES[k].label} · {DEVICES[k].w}×{DEVICES[k].h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => setLandscape((s) => !s)} aria-pressed={landscape} title="Rotate">
          <RotateCw className="mr-1 h-4 w-4" /> {landscape ? "Landscape" : "Portrait"}
        </Button>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          Zoom
          <input
            type="range"
            min={0.4}
            max={1}
            step={0.05}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="w-20 accent-primary"
          />
          <span className="w-8 font-mono text-[10px]">{Math.round(scale * 100)}%</span>
        </label>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <input type="checkbox" checked={autoRun} onChange={(e) => setAutoRun(e.target.checked)} />
          Auto-run
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowDebug((s) => !s)}
            aria-pressed={showDebug}
            aria-label={showDebug ? "Hide AI debug helper" : "Show AI debug helper"}
            title={showDebug ? "Hide AI debug helper" : "Show AI debug helper"}
          >
            {showDebug ? <BugOff className="mr-1 h-4 w-4" /> : <Bug className="mr-1 h-4 w-4" />}
            {showDebug ? "Hide" : "Show"} AI
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setDebounced({ html, css, js }); setPreviewKey((k) => k + 1); }}>
            <RefreshCw className="mr-1 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex h-[50vh] shrink-0 flex-col border-b border-border/60 lg:h-auto lg:flex-1 lg:border-b-0 lg:border-r">
          <Tabs defaultValue="html" className="flex h-full flex-col">
            <TabsList className="m-2 w-fit">
              <TabsTrigger value="html">HTML</TabsTrigger>
              <TabsTrigger value="css">CSS</TabsTrigger>
              <TabsTrigger value="js">JS</TabsTrigger>
            </TabsList>
            <TabsContent value="html" className="m-0 flex-1">
              <Editor height="100%" language="html" value={html} theme="vs-dark" onChange={(v) => setHtml(v ?? "")} options={{ minimap: { enabled: false }, fontSize: 14, automaticLayout: true, tabSize: 2 }} />
            </TabsContent>
            <TabsContent value="css" className="m-0 flex-1">
              <Editor height="100%" language="css" value={css} theme="vs-dark" onChange={(v) => setCss(v ?? "")} options={{ minimap: { enabled: false }, fontSize: 14, automaticLayout: true, tabSize: 2 }} />
            </TabsContent>
            <TabsContent value="js" className="m-0 flex-1">
              <Editor height="100%" language="javascript" value={js} theme="vs-dark" onChange={(v) => setJs(v ?? "")} options={{ minimap: { enabled: false }, fontSize: 14, automaticLayout: true, tabSize: 2 }} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex w-full min-w-0 flex-col lg:w-[55%]">
          <div className="flex items-center justify-between border-b border-border/60 bg-card/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Live preview</span>
            <span className="font-mono text-[10px] normal-case tracking-normal text-muted-foreground/80">
              {d.label} · {baseW}×{baseH}
            </span>
          </div>

          <div className="flex flex-1 items-center justify-center overflow-auto bg-gradient-to-br from-muted/40 to-background p-4">
            <div
              className="relative shrink-0 bg-black shadow-2xl"
              style={{
                width: baseW * scale + 24,
                height: baseH * scale + 24,
                borderRadius: (d.radius + 6) * scale,
                padding: 12 * scale,
              }}
            >
              {d.notch && !landscape && (
                <div
                  className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full bg-black"
                  style={{ width: 110 * scale, height: 26 * scale }}
                  aria-hidden
                />
              )}
              <iframe
                ref={iframeRef}
                key={previewKey}
                title="mobile-preview"
                data-testid="mobile-preview"
                sandbox="allow-scripts allow-modals allow-forms"
                srcDoc={srcDoc}
                style={{
                  width: baseW,
                  height: baseH,
                  borderRadius: d.radius,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  border: 0,
                  background: "white",
                  display: "block",
                }}
              />
            </div>
          </div>

          {showDebug && (
            <WebAiDebugPanel
              html={html}
              css={css}
              js={js}
              consoleErrors={consoleErrors}
              onApply={(next) => {
                if (next.html !== undefined) setHtml(next.html);
                if (next.css !== undefined) setCss(next.css);
                if (next.js !== undefined) setJs(next.js);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

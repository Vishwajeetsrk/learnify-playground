import { createFileRoute } from "@tanstack/react-router";
import Editor from "@monaco-editor/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Bug, BugOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WebAiDebugPanel } from "@/components/web-ai-debug-panel";

const STARTER_HTML = `<!doctype html>
<html>
  <head><meta charset="utf-8" /></head>
  <body>
    <h1>Hello, web playground!</h1>
    <button id="b">Click me</button>
  </body>
</html>`;
const STARTER_CSS = `body { font-family: system-ui, sans-serif; padding: 2rem; background: #0f172a; color: #f8fafc; }
button { padding: .5rem 1rem; border-radius: 6px; border: 0; background: #6366f1; color: white; cursor: pointer; }`;
const STARTER_JS = `document.getElementById('b').addEventListener('click', () => {
  alert('It works!');
});`;

function buildErrorBridge(nonce: string) {
  // Bridge runs inside the sandboxed iframe. We sign every message with a
  // per-render nonce so the parent can reject spoofed messages from other
  // frames, browser extensions, or attacker-controlled origins.
  return `<script>
(function(){
  var NONCE = ${JSON.stringify(nonce)};
  var seq = 0;
  function send(type, msg){
    try { parent.postMessage({ __webpg: true, nonce: NONCE, seq: ++seq, type: type, msg: String(msg) }, '*'); } catch(_){}
  }
  window.addEventListener('error', function(e){
    send('error', (e.message || 'Error') + (e.filename ? ' @ ' + e.filename + ':' + e.lineno : ''));
  });
  window.addEventListener('unhandledrejection', function(e){
    var r = e.reason; send('error', 'Unhandled rejection: ' + (r && r.message ? r.message : String(r)));
  });
  var origErr = console.error;
  console.error = function(){ send('error', Array.from(arguments).map(String).join(' ')); origErr.apply(console, arguments); };
})();
<\/script>`;
}

export const Route = createFileRoute("/playground/web")({
  head: () => ({ meta: [{ title: "Web Playground" }] }),
  component: WebPlayground,
});

function WebPlayground() {
  const [html, setHtml] = useState(STARTER_HTML);
  const [css, setCss] = useState(STARTER_CSS);
  const [js, setJs] = useState(STARTER_JS);
  const [previewKey, setPreviewKey] = useState(0);
  const [autoRun, setAutoRun] = useState(true);
  const [showDebug, setShowDebug] = useState(true);
  const [debounced, setDebounced] = useState({ html, css, js });
  const [consoleErrors, setConsoleErrors] = useState("");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  // Per-render nonce so messages from a previous srcDoc cannot leak into the
  // new one and external frames cannot spoof errors.
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
      // 1. Source check: must come from our preview iframe's window.
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return;
      const d = e.data as { __webpg?: boolean; nonce?: string; seq?: number; type?: string; msg?: string };
      if (!d || !d.__webpg) return;
      // 2. Nonce check: rejects messages from a prior srcDoc or spoofers.
      if (d.nonce !== nonce) return;
      if (d.type !== "error" || !d.msg) return;
      // 3. Dedupe: same (seq, msg) only once.
      const key = `${d.seq}:${d.msg}`;
      if (seenRef.current.has(key)) return;
      seenRef.current.add(key);
      setConsoleErrors((prev) => (prev ? prev + "\n" : "") + d.msg);
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [nonce]);

  const srcDoc = useMemo(() => {
    return `${debounced.html}\n<style>${debounced.css}</style>\n${buildErrorBridge(nonce)}\n<script>${debounced.js}<\/script>`;
  }, [debounced, nonce]);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col lg:h-[calc(100vh-3.5rem)]">
      <h1 className="sr-only">Web Playground</h1>
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-card/40 p-2">
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
            {showDebug ? "Hide" : "Show"} AI helper
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDebounced({ html, css, js });
              setPreviewKey((k) => k + 1);
            }}
          >
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

        <div className="flex w-full min-w-0 flex-col lg:w-[45%]">
          <div className="border-b border-border/60 bg-card/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Live preview
          </div>
          <iframe
            ref={iframeRef}
            key={previewKey}
            title="preview"
            data-testid="web-preview"
            sandbox="allow-scripts allow-modals"
            srcDoc={srcDoc}
            className="min-h-[260px] w-full flex-1 bg-white"
          />
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

import { createFileRoute } from "@tanstack/react-router";
import Editor from "@monaco-editor/react";
import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
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

const ERROR_BRIDGE = `<script>
(function(){
  function send(type, msg){ parent.postMessage({ __webpg: true, type, msg }, '*'); }
  window.addEventListener('error', function(e){
    send('error', (e.message || 'Error') + (e.filename ? ' @ ' + e.filename + ':' + e.lineno : ''));
  });
  window.addEventListener('unhandledrejection', function(e){
    send('error', 'Unhandled rejection: ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason)));
  });
  var origErr = console.error;
  console.error = function(){ send('error', Array.from(arguments).map(String).join(' ')); origErr.apply(console, arguments); };
})();
<\/script>`;

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
  const [debounced, setDebounced] = useState({ html, css, js });
  const [consoleErrors, setConsoleErrors] = useState("");

  useEffect(() => {
    if (!autoRun) return;
    const t = setTimeout(() => setDebounced({ html, css, js }), 500);
    return () => clearTimeout(t);
  }, [html, css, js, autoRun]);

  useEffect(() => {
    setConsoleErrors("");
  }, [debounced, previewKey]);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const d = e.data as { __webpg?: boolean; type?: string; msg?: string };
      if (d && d.__webpg && d.type === "error" && d.msg) {
        setConsoleErrors((prev) => (prev ? prev + "\n" : "") + d.msg);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const srcDoc = useMemo(() => {
    return `${debounced.html}\n<style>${debounced.css}</style>\n${ERROR_BRIDGE}\n<script>${debounced.js}<\/script>`;
  }, [debounced]);

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
            key={previewKey}
            title="preview"
            sandbox="allow-scripts allow-modals"
            srcDoc={srcDoc}
            className="min-h-[260px] w-full flex-1 bg-white"
          />
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
        </div>
      </div>
    </div>
  );
}

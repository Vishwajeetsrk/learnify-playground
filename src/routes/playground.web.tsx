import { createFileRoute } from "@tanstack/react-router";
import Editor from "@monaco-editor/react";
import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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

  useEffect(() => {
    if (!autoRun) return;
    const t = setTimeout(() => setDebounced({ html, css, js }), 500);
    return () => clearTimeout(t);
  }, [html, css, js, autoRun]);

  const srcDoc = useMemo(() => {
    return `${debounced.html}\n<style>${debounced.css}</style>\n<script>${debounced.js}<\/script>`;
  }, [debounced]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
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
        <div className="flex min-h-[40vh] flex-1 flex-col border-b border-border/60 lg:border-b-0 lg:border-r">
          <Tabs defaultValue="html" className="flex h-full flex-col">
            <TabsList className="m-2 w-fit">
              <TabsTrigger value="html">HTML</TabsTrigger>
              <TabsTrigger value="css">CSS</TabsTrigger>
              <TabsTrigger value="js">JS</TabsTrigger>
            </TabsList>
            <TabsContent value="html" className="m-0 flex-1">
              <Editor
                height="100%"
                language="html"
                value={html}
                theme="vs-dark"
                onChange={(v) => setHtml(v ?? "")}
                options={{ minimap: { enabled: false }, fontSize: 14, automaticLayout: true, tabSize: 2 }}
              />
            </TabsContent>
            <TabsContent value="css" className="m-0 flex-1">
              <Editor
                height="100%"
                language="css"
                value={css}
                theme="vs-dark"
                onChange={(v) => setCss(v ?? "")}
                options={{ minimap: { enabled: false }, fontSize: 14, automaticLayout: true, tabSize: 2 }}
              />
            </TabsContent>
            <TabsContent value="js" className="m-0 flex-1">
              <Editor
                height="100%"
                language="javascript"
                value={js}
                theme="vs-dark"
                onChange={(v) => setJs(v ?? "")}
                options={{ minimap: { enabled: false }, fontSize: 14, automaticLayout: true, tabSize: 2 }}
              />
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex min-h-[35vh] w-full flex-col lg:w-[45%]">
          <div className="border-b border-border/60 bg-card/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Live preview
          </div>
          <iframe
            key={previewKey}
            title="preview"
            sandbox="allow-scripts allow-modals"
            srcDoc={srcDoc}
            className="h-full w-full flex-1 bg-white"
          />
        </div>
      </div>
    </div>
  );
}

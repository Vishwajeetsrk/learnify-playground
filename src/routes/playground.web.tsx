import { createFileRoute, useNavigate } from "@tanstack/react-router";
import Editor from "@monaco-editor/react";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { ProjectSidebar, type PlaygroundProject } from "@/components/project-sidebar";

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
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [html, setHtml] = useState(STARTER_HTML);
  const [css, setCss] = useState(STARTER_CSS);
  const [js, setJs] = useState(STARTER_JS);
  const [name, setName] = useState("Untitled");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [autoRun, setAutoRun] = useState(true);
  const [debounced, setDebounced] = useState({ html, css, js });
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { redirect: "/playground/web" } });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!autoRun) return;
    const t = setTimeout(() => setDebounced({ html, css, js }), 500);
    return () => clearTimeout(t);
  }, [html, css, js, autoRun]);

  const srcDoc = useMemo(() => {
    return `${debounced.html}\n<style>${debounced.css}</style>\n<script>${debounced.js}<\/script>`;
  }, [debounced]);

  function newProject() {
    setProjectId(null);
    setName("Untitled");
    setHtml(STARTER_HTML);
    setCss(STARTER_CSS);
    setJs(STARTER_JS);
  }

  function openProject(p: PlaygroundProject) {
    setProjectId(p.id);
    setName(p.name);
    setHtml(p.html ?? "");
    setCss(p.css ?? "");
    setJs(p.js ?? "");
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      name: name.trim() || "Untitled",
      kind: "web" as const,
      html,
      css,
      js,
    };
    if (projectId) {
      const { error } = await supabase
        .from("playground_projects")
        .update(payload)
        .eq("id", projectId);
      if (error) toast.error(error.message);
      else toast.success("Saved");
    } else {
      const { data, error } = await supabase
        .from("playground_projects")
        .insert(payload)
        .select("id")
        .single();
      if (error) toast.error(error.message);
      else {
        setProjectId(data.id);
        toast.success("Project saved");
      }
    }
    setSaving(false);
    setRefreshKey((k) => k + 1);
  }

  if (loading || !user) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col lg:flex-row">
      <div className="hidden lg:block">
        <ProjectSidebar
          kind="web"
          currentId={projectId}
          onOpen={openProject}
          onNew={newProject}
          refreshKey={refreshKey}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-card/40 p-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 w-40 sm:w-56"
            placeholder="Project name"
          />
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
            <Button size="sm" variant="secondary" onClick={handleSave} disabled={saving}>
              <Save className="mr-1 h-4 w-4" /> Save
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
    </div>
  );
}

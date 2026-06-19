import { useEffect, useState } from "react";
import { Loader2, Pencil, Trash2, FolderOpen, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface PlaygroundProject {
  id: string;
  name: string;
  kind: "code" | "web";
  language: string | null;
  code: string | null;
  html: string | null;
  css: string | null;
  js: string | null;
  updated_at: string;
}

interface Props {
  kind: "code" | "web";
  currentId: string | null;
  onOpen: (p: PlaygroundProject) => void;
  onNew: () => void;
  refreshKey: number;
}

export function ProjectSidebar({ kind, currentId, onOpen, onNew, refreshKey }: Props) {
  const [projects, setProjects] = useState<PlaygroundProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [renaming, setRenaming] = useState<PlaygroundProject | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<PlaygroundProject | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("playground_projects")
      .select("id,name,kind,language,code,html,css,js,updated_at")
      .eq("kind", kind)
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setProjects((data as PlaygroundProject[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, refreshKey]);

  async function doRename() {
    if (!renaming) return;
    const name = renameValue.trim();
    if (!name) return;
    const { error } = await supabase.from("playground_projects").update({ name }).eq("id", renaming.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Renamed");
      setRenaming(null);
      void load();
    }
  }

  async function doDelete() {
    if (!deleting) return;
    const { error } = await supabase.from("playground_projects").delete().eq("id", deleting.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      setDeleting(null);
      void load();
    }
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-border/60 bg-card/40 lg:w-64">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          My projects
        </h3>
        <Button size="sm" variant="ghost" onClick={onNew} title="New">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center p-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No saved projects yet.</p>
        ) : (
          <ul className="space-y-1 p-2">
            {projects.map((p) => (
              <li
                key={p.id}
                className={`group rounded-md border border-transparent px-2 py-2 hover:bg-accent ${
                  currentId === p.id ? "border-border bg-accent" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <button
                    onClick={() => onOpen(p)}
                    className="flex flex-1 items-center gap-2 truncate text-left text-sm"
                    title={p.name}
                  >
                    <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{p.name}</span>
                  </button>
                  <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => {
                        setRenaming(p);
                        setRenameValue(p.name);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => setDeleting(p)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {p.language && (
                  <span className="ml-5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {p.language}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button onClick={doRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleting?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

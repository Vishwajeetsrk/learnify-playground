import { useState } from "react";
import { Key, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useUserApiKey } from "@/lib/user-api-key";

export function ByoKeyButton() {
  const { key, save, hasKey } = useUserApiKey();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(key);
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          title={hasKey ? "Your OpenRouter key is set" : "Use your own AI key"}
          className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] transition ${
            hasKey
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
              : "border-border bg-background text-foreground/80 hover:bg-muted"
          }`}
        >
          {hasKey ? <Check className="h-3 w-3" /> : <Key className="h-3 w-3" />}
          {hasKey ? "Your key" : "Your key"}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bring your own AI key</DialogTitle>
          <DialogDescription>
            If the built-in AI hits a rate limit or quota, the playground will use your
            OpenRouter key instead. The key stays only in your browser (localStorage) and
            is sent per request to power the AI assistant.
            <br />
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              Get a free OpenRouter key →
            </a>
          </DialogDescription>
        </DialogHeader>
        <input
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="sk-or-v1-…"
          className="h-9 w-full rounded-md border border-input bg-background px-2 font-mono text-xs outline-none focus:ring-1 focus:ring-ring"
          autoComplete="off"
          spellCheck={false}
        />
        <DialogFooter className="gap-2 sm:gap-0">
          {hasKey && (
            <Button
              variant="ghost"
              onClick={() => {
                save("");
                setDraft("");
                toast.success("Key removed");
                setOpen(false);
              }}
            >
              Remove
            </Button>
          )}
          <Button
            onClick={() => {
              save(draft);
              toast.success(draft.trim() ? "Key saved in this browser" : "Key cleared");
              setOpen(false);
            }}
          >
            Save key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

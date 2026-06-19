import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { debugCode } from "@/lib/ai.functions";

interface Props {
  language: string;
  code: string;
  output: string;
}

export function AiDebugPanel({ language, code, output }: Props) {
  const ask = useServerFn(debugCode);
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!code.trim()) {
      toast.error("Write some code first");
      return;
    }
    setLoading(true);
    setReply("");
    try {
      const res = await ask({ data: { language, code, output, question } });
      setReply(res.reply);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border/60 bg-card/30 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" /> AI debug helper
        <span className="ml-auto text-[10px] font-normal normal-case text-muted-foreground/70">
          Powered by Lovable AI · free for this project
        </span>
      </div>
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about an error, or leave blank to auto-diagnose…"
          className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) run();
          }}
        />
        <Button size="sm" onClick={run} disabled={loading}>
          {loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
          Ask AI
        </Button>
      </div>
      {reply && (
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border/60 bg-background p-2 text-xs leading-relaxed">
          {reply}
        </pre>
      )}
    </div>
  );
}

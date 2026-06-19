import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { PROVIDERS, readUsage, type ProviderKey } from "@/lib/executors";

export function QuotaIndicator({ provider }: { provider: ProviderKey }) {
  const [usage, setUsage] = useState(() => readUsage());

  useEffect(() => {
    const handler = () => setUsage(readUsage());
    window.addEventListener("playground-usage", handler);
    return () => window.removeEventListener("playground-usage", handler);
  }, []);

  const limit = PROVIDERS[provider].dailyFreeLimit;
  const used = usage.counts[provider] ?? 0;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const warn = pct >= 80;
  const danger = pct >= 100;

  return (
    <div
      className="flex items-center gap-2 rounded-md border border-border/60 bg-card/40 px-2 py-1 text-xs"
      title={`${PROVIDERS[provider].label} · ${PROVIDERS[provider].description}`}
    >
      <Activity className={`h-3.5 w-3.5 ${danger ? "text-destructive" : warn ? "text-yellow-500" : "text-primary"}`} />
      <span className="text-muted-foreground">
        {used}/{limit} runs today
      </span>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all ${danger ? "bg-destructive" : warn ? "bg-yellow-500" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

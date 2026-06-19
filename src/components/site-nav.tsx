import { Link } from "@tanstack/react-router";
import { Code2, Github, Star, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  GITHUB_OWNER,
  GITHUB_OWNER_URL,
  GITHUB_REPO_URL,
  formatCompact,
  useRepoStars,
} from "@/lib/github";

const NAV = [
  { to: "/playground", label: "Code" },
  { to: "/playground/web", label: "Web" },
  { to: "/playground/mobile", label: "Mobile" },
  { to: "/tools", label: "Tools" },
] as const;

function StarCount() {
  const { data, isLoading, isError } = useRepoStars();
  if (isLoading) {
    return <span className="inline-block h-3 w-5 animate-pulse rounded bg-foreground/20" aria-label="Loading stars" />;
  }
  if (isError || !data) return null;
  return (
    <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-foreground">
      {formatCompact(data.stargazers_count)}
    </span>
  );
}

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:px-4">
        <Link to="/" className="group flex shrink-0 items-center gap-2 font-semibold tracking-tight" aria-label="Polyglot Orbit home">
          <Code2 className="h-5 w-5 text-primary transition-transform group-hover:rotate-12" />
          <span className="hidden bg-gradient-to-r from-primary via-fuchsia-500 to-cyan-400 bg-clip-text text-transparent sm:inline">Polyglot Orbit</span>
        </Link>
        <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto sm:justify-end sm:gap-1">
          {NAV.map((n) => (
            <Button key={n.to} asChild variant="ghost" size="sm" className="shrink-0 px-2 sm:px-3">
              <Link to={n.to}>{n.label}</Link>
            </Button>
          ))}
          <a
            href={GITHUB_OWNER_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Follow ${GITHUB_OWNER} on GitHub`}
            className="hidden shrink-0 items-center gap-1.5 rounded-full border border-border bg-card/70 px-2.5 py-1.5 text-xs font-medium text-foreground backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_8px_30px_hsl(var(--primary)/0.18)] md:inline-flex"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Follow</span>
          </a>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Star repository on GitHub"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card/70 px-2.5 py-1.5 text-xs font-medium text-foreground backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_8px_30px_hsl(var(--primary)/0.18)] sm:px-3"
          >
            <Github className="h-3.5 w-3.5" />
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="hidden sm:inline">Star</span>
            <StarCount />
          </a>
        </nav>
      </div>
    </header>
  );
}

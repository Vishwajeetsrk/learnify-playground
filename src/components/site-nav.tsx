import { Link } from "@tanstack/react-router";
import { Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/playground", label: "Code" },
  { to: "/playground/web", label: "Web" },
  { to: "/playground/mobile", label: "Mobile" },
  { to: "/tools", label: "Tools" },
] as const;

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
        </nav>
      </div>
    </header>
  );
}

import { Link } from "@tanstack/react-router";
import { Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Code2 className="h-5 w-5 text-primary" />
          <span>Playground</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/playground">Code</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/playground/web">Web</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/tools">Tools</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

import { Link } from "@tanstack/react-router";
import { Code2, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function SiteNav() {
  const { user, signOut } = useAuth();
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
          {user ? (
            <>
              <span className="hidden items-center gap-1 px-2 text-xs text-muted-foreground sm:inline-flex">
                <UserIcon className="h-3.5 w-3.5" />
                {user.email}
              </span>
              <Button size="sm" variant="outline" onClick={() => signOut()}>
                <LogOut className="mr-1 h-4 w-4" /> Sign out
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

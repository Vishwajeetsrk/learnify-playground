import { Link, createFileRoute } from "@tanstack/react-router";
import { Code2, Globe, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Coding Playground" },
      { name: "description", content: "Run code in 11 languages and build live web projects in your browser." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
      <div className="text-center">
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <Play className="h-3 w-3" /> Powered by Piston + Monaco
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
          Code, run, and ship — from your browser.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          A coding playground for 11 languages and a live HTML / CSS / JS sandbox. Save your projects,
          rename them, and pick up where you left off.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/playground">
              <Code2 className="mr-2 h-4 w-4" /> Open code playground
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/playground/web">
              <Globe className="mr-2 h-4 w-4" /> Open web playground
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-16 grid gap-4 sm:grid-cols-3">
        {[
          { t: "11 languages", d: "Python, JS, TS, Java, C, C++, C#, PHP, Go, Rust, Kotlin." },
          { t: "Live web sandbox", d: "Edit HTML, CSS and JS with an instant iframe preview." },
          { t: "No sign-up", d: "Open the editor and start coding — nothing to install or log in." },
        ].map((f) => (
          <div key={f.t} className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-semibold">{f.t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </div>

    </main>
  );
}

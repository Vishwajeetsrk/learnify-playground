import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

import { SiteNav } from "../components/site-nav";
import { Toaster } from "../components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Polyglot Orbit · Code, Web & Mobile Playground" },
      { name: "description", content: "Polyglot Orbit — a 3D playground for 18+ languages, a live web sandbox, and one-click mobile starters." },
      { name: "author", content: "Polyglot Orbit" },
      { name: "keywords", content: "code playground, online IDE, polyglot, web sandbox, mobile starters, open source, GitHub" },
      { property: "og:site_name", content: "Polyglot Orbit" },
      { property: "og:title", content: "Polyglot Orbit · Open-source code, web & mobile playground" },
      { property: "og:description", content: "Run 18+ languages, prototype web UIs live, and scaffold mobile apps — open source on GitHub. Star ⭐ the repo!" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://opengraph.githubassets.com/1/Vishwajeetsrk/learnify-playground" },
      { property: "og:image:alt", content: "Polyglot Orbit on GitHub — star the repo" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@PolyglotOrbit" },
      { name: "twitter:title", content: "Polyglot Orbit · Open-source code playground" },
      { name: "twitter:description", content: "Run 18+ languages, prototype web UIs, scaffold mobile apps. ⭐ Star on GitHub." },
      { name: "twitter:image", content: "https://opengraph.githubassets.com/1/Vishwajeetsrk/learnify-playground" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col">
        <SiteNav />
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </div>
      <Toaster />
    </QueryClientProvider>

  );
}

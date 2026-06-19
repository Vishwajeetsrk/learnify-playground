import { Link, createFileRoute } from "@tanstack/react-router";
import { Code2, Globe, Smartphone, Play, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Coding Playground · Code, Web & Mobile" },
      { name: "description", content: "Interactive 3D playground for 18+ languages, live web sandbox, and mobile starters. Run, ship, share — from your browser." },
    ],
  }),
  component: Landing,
});

// Real brand logos via simple-icons CDN (SVG, color, cached).
// `to` routes each logo to the matching playground track.
type Track = "/playground" | "/playground/web" | "/playground/mobile";
const LANGS: { name: string; slug: string; color: string; to: Track; lang?: string }[] = [
  { name: "Python",      slug: "python",      color: "#3776AB", to: "/playground",        lang: "python" },
  { name: "JavaScript",  slug: "javascript",  color: "#F7DF1E", to: "/playground",        lang: "javascript" },
  { name: "TypeScript",  slug: "typescript",  color: "#3178C6", to: "/playground",        lang: "typescript" },
  { name: "Java",        slug: "openjdk",     color: "#ED8B00", to: "/playground",        lang: "java" },
  { name: "C",           slug: "c",           color: "#A8B9CC", to: "/playground",        lang: "c" },
  { name: "C++",         slug: "cplusplus",   color: "#00599C", to: "/playground",        lang: "cpp" },
  { name: "C#",          slug: "dotnet",      color: "#512BD4", to: "/playground",        lang: "csharp" },
  { name: "PHP",         slug: "php",         color: "#777BB4", to: "/playground",        lang: "php" },
  { name: "Go",          slug: "go",          color: "#00ADD8", to: "/playground",        lang: "go" },
  { name: "Rust",        slug: "rust",        color: "#CE422B", to: "/playground",        lang: "rust" },
  { name: "Ruby",        slug: "ruby",        color: "#CC342D", to: "/playground",        lang: "ruby" },
  { name: "Bash",        slug: "gnubash",     color: "#4EAA25", to: "/playground",        lang: "bash" },
  { name: "Kotlin",      slug: "kotlin",      color: "#7F52FF", to: "/playground/mobile", lang: "kotlin" },
  { name: "Swift",       slug: "swift",       color: "#F05138", to: "/playground/mobile", lang: "swift" },
  { name: "Scala",       slug: "scala",       color: "#DC322F", to: "/playground",        lang: "scala" },
  { name: "Dart",        slug: "dart",        color: "#0175C2", to: "/playground/mobile", lang: "dart" },
  { name: "SQL",         slug: "sqlite",      color: "#003B57", to: "/playground",        lang: "sql" },
  { name: "HTML",        slug: "html5",       color: "#E34F26", to: "/playground/web" },
  { name: "CSS",         slug: "css",         color: "#1572B6", to: "/playground/web" },
  { name: "React",       slug: "react",       color: "#61DAFB", to: "/playground/web" },
  { name: "Android",     slug: "android",     color: "#3DDC84", to: "/playground/mobile", lang: "kotlin" },
  { name: "iOS",         slug: "apple",       color: "#A8A8A8", to: "/playground/mobile", lang: "swift" },
  { name: "Flutter",     slug: "flutter",     color: "#02569B", to: "/playground/mobile", lang: "dart" },
];

function logoUrl(slug: string) {
  // Simple Icons CDN, color variant. Falls back to devicon if blocked.
  return `https://cdn.simpleicons.org/${slug}`;
}

function logoFallback(slug: string) {
  return `https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${slug}/${slug}-original.svg`;
}


function Landing() {
  return (
    <main className="relative overflow-hidden bg-background text-foreground">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-10%] h-[420px] w-[820px] -translate-x-1/2 rounded-full blur-3xl opacity-40"
             style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.45), transparent 70%)" }} />
        <div className="absolute right-[-10%] bottom-[-20%] h-[420px] w-[620px] rounded-full blur-3xl opacity-30"
             style={{ background: "radial-gradient(closest-side, hsl(var(--accent, var(--primary)) / 0.4), transparent 70%)" }} />
        <div className="absolute inset-0 opacity-[0.04]"
             style={{
               backgroundImage:
                 "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
               backgroundSize: "44px 44px",
             }} />
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-10 sm:pt-24 sm:pb-14">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3" /> Powered by Piston · Monaco · AI Gateway
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
            Code, run, and ship —
            <span className="block bg-gradient-to-r from-primary via-fuchsia-500 to-cyan-400 bg-clip-text text-transparent">
              from your browser.
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Three playgrounds in one: a multi-language code runner, a live HTML/CSS/JS sandbox,
            and mobile starters that export to Android, iOS &amp; Flutter.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/playground"><Play className="mr-2 h-4 w-4" /> Launch playground</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/playground/web"><Globe className="mr-2 h-4 w-4" /> Try the web sandbox</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 3D demo cards: Code · Web · Mobile */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-6 md:grid-cols-3" style={{ perspective: "1400px" }}>
          <DemoCard
            to="/playground"
            tint="from-sky-500/30 to-indigo-500/30"
            icon={<Code2 className="h-5 w-5" />}
            title="Code"
            subtitle="18+ languages · instant run"
          >
            <pre className="font-mono text-[11px] leading-relaxed text-foreground/90">
{`# fib.py
def fib(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

print(fib(20))  → 6765`}
            </pre>
          </DemoCard>

          <DemoCard
            to="/playground/web"
            tint="from-fuchsia-500/30 to-rose-500/30"
            icon={<Globe className="h-5 w-5" />}
            title="Web"
            subtitle="Live HTML · CSS · JS preview"
          >
            <div className="grid h-full grid-cols-3 gap-1.5">
              {[ "#F7DF1E", "#E34F26", "#1572B6" ].map((c, i) => (
                <div key={i} className="rounded-md border border-border/60"
                     style={{ background: `linear-gradient(135deg, ${c}30, transparent)` }} />
              ))}
              <div className="col-span-3 rounded-md border border-border/60 bg-background/40 px-2 py-1.5 font-mono text-[10px]">
                &lt;button class=&quot;btn&quot;&gt;Ship it&lt;/button&gt;
              </div>
            </div>
          </DemoCard>

          <DemoCard
            to="/playground/mobile"
            tint="from-emerald-500/30 to-cyan-500/30"
            icon={<Smartphone className="h-5 w-5" />}
            title="Mobile"
            subtitle="Android · iOS · Flutter export"
          >
            <PhoneMock />
          </DemoCard>
        </div>
      </section>

      {/* 3D rotating ring of language logos */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Every language, real logos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Hover to pause. Click any logo to jump into the matching playground.
            </p>
          </div>
          <Link to="/tools" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            See all tools <ArrowRight className="h-3.5 w-3.5" />

          </Link>
        </div>

        <LogoRing items={LANGS} />

        {/* Static grid below for full discoverability */}
        <div className="mt-12 grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
          {LANGS.map((l) => (
            <LogoTile key={l.slug} name={l.name} slug={l.slug} color={l.color} to={l.to} lang={l.lang} />
          ))}
        </div>
      </section>
    </main>
  );
}

/* ---------------- Components ---------------- */

function DemoCard({
  to, tint, icon, title, subtitle, children,
}: {
  to: string; tint: string; icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <Link to={to} className="group relative block">
      <div
        className="relative h-[260px] rounded-2xl border border-border bg-card/80 p-5 backdrop-blur transition-transform duration-300 ease-out will-change-transform hover:-translate-y-1 group-hover:[transform:rotateX(6deg)_rotateY(-8deg)_translateZ(0)]"
        style={{ transformStyle: "preserve-3d" }}
      >
        <div className={`pointer-events-none absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br ${tint} opacity-60 blur-md`} />
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-md border border-border bg-background/60 px-2 py-1 text-xs font-medium">
            {icon} {title}
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{subtitle}</span>
        </div>
        <div className="mt-4 h-[160px] overflow-hidden rounded-xl border border-border/70 bg-background/50 p-3"
             style={{ transform: "translateZ(40px)" }}>
          {children}
        </div>
        <div className="mt-3 flex items-center justify-end text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Open <ArrowRight className="ml-1 h-3 w-3" />
        </div>
      </div>
    </Link>
  );
}

function PhoneMock() {
  return (
    <div className="mx-auto flex h-full w-[110px] flex-col rounded-[18px] border border-border bg-background/70 p-1.5 shadow-inner">
      <div className="mx-auto mb-1 h-1 w-8 rounded-full bg-border" />
      <div className="flex-1 rounded-[12px] bg-gradient-to-br from-emerald-400/30 to-cyan-400/30 p-2">
        <div className="mb-1.5 h-2 w-10 rounded bg-foreground/40" />
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-md bg-foreground/15 animate-pulse"
                 style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LogoTile({ name, slug, color, to, lang }: { name: string; slug: string; color: string; to: Track; lang?: string }) {
  return (
    <Link
      to={to}
      search={lang ? { lang } : undefined}
      className="group relative flex aspect-square items-center justify-center rounded-xl border border-border bg-card/70 p-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
      style={{ transformStyle: "preserve-3d" }}
      title={name}
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10 rounded-xl opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-70"
        style={{ background: `radial-gradient(closest-side, ${color}55, transparent 70%)` }}
      />
      <img
        src={logoUrl(slug)}
        alt={`${name} logo`}
        loading="lazy"
        width={40}
        height={40}
        className="h-10 w-10 transition-transform duration-500 group-hover:[transform:rotateY(360deg)_scale(1.1)]"
        style={{ transformStyle: "preserve-3d" }}
        onError={(e) => {
          const img = e.currentTarget;
          if (!img.dataset.fb) { img.dataset.fb = "1"; img.src = logoFallback(slug); }
        }}
      />
      <span className="absolute bottom-1 left-0 right-0 text-center text-[10px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
        {name}
      </span>
    </Link>
  );
}

function LogoRing({ items }: { items: { name: string; slug: string; color: string; to: Track; lang?: string }[] }) {
  const radius = 260; // px
  const step = 360 / items.length;
  return (
    <div className="logo-ring-wrap relative mx-auto h-[340px] w-full max-w-[640px]" style={{ perspective: "1200px" }}>
      <style>{`
        @keyframes ring-spin { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }
        .logo-ring { animation: ring-spin 28s linear infinite; transform-style: preserve-3d; }
        .logo-ring-wrap:hover .logo-ring { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .logo-ring { animation: none; } }
      `}</style>
      {/* Floor reflection */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 -z-10 h-[60px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] opacity-50 blur-2xl"
        style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.4), transparent 70%)" }}
      />
      <div className="logo-ring absolute left-1/2 top-1/2 h-0 w-0">
        {items.map((it, i) => {
          const angle = i * step;
          return (
            <Link
              key={it.slug}
              to={it.to}
              search={it.lang ? { lang: it.lang } : undefined}
              title={`${it.name} — open playground`}
              className="group absolute -left-7 -top-7 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card/90 shadow-lg backdrop-blur transition-colors hover:border-primary"
              style={{
                transform: `rotateY(${angle}deg) translateZ(${radius}px)`,
                transformStyle: "preserve-3d",
              }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 rounded-2xl opacity-40 blur-md"
                style={{ background: `radial-gradient(closest-side, ${it.color}60, transparent 70%)` }}
              />
              <img
                src={logoUrl(it.slug)}
                alt={`${it.name} logo`}
                loading="lazy"
                width={32}
                height={32}
                className="h-8 w-8"
                /* Counter-rotate so logos always face the camera */
                style={{ transform: `rotateY(${-angle}deg)` }}
                onError={(e) => {
                  const img = e.currentTarget;
                  if (!img.dataset.fb) { img.dataset.fb = "1"; img.src = logoFallback(it.slug); }
                }}
              />
            </Link>
          );
        })}
      </div>
    </div>

  );
}

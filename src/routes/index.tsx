import { Link, createFileRoute } from "@tanstack/react-router";
import { Code2, Globe, Smartphone, Play, Sparkles, ArrowRight, Cpu, Zap, Github, Star, Users, GitCommit } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { GITHUB_REPO_URL, useContributors } from "@/lib/github";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Polyglot Orbit · Code, Web & Mobile Playground" },
      { name: "description", content: "Polyglot Orbit — a 3D playground for 18+ languages, a live web sandbox, and one-click mobile starters. Run, ship, share — from your browser." },
    ],
  }),
  component: Landing,
});

// Real brand logos via simple-icons CDN (SVG, color, cached).
// `to` routes each logo to the matching playground track.
// Every slug below has been verified against simpleicons.org.
type Track = "/playground" | "/playground/web" | "/playground/mobile";
const LANGS: { name: string; slug: string; color: string; to: Track; lang?: string }[] = [
  { name: "Python",      slug: "python",      color: "#3776AB", to: "/playground",        lang: "python" },
  { name: "JavaScript",  slug: "javascript",  color: "#F7DF1E", to: "/playground",        lang: "javascript" },
  { name: "TypeScript",  slug: "typescript",  color: "#3178C6", to: "/playground",        lang: "typescript" },
  { name: "Java",        slug: "openjdk",     color: "#ED8B00", to: "/playground",        lang: "java" },
  { name: "C",           slug: "c",           color: "#A8B9CC", to: "/playground",        lang: "c" },
  { name: "C++",         slug: "cplusplus",   color: "#00599C", to: "/playground",        lang: "cpp" },
  { name: "C#",          slug: "sharp",       color: "#9B4F96", to: "/playground",        lang: "csharp" },
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
  return `https://cdn.simpleicons.org/${slug}`;
}
// Multi-CDN fallback chain so no tile ever shows blank.
function logoFallbacks(slug: string): string[] {
  const devicon = `https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${slug}/${slug}-original.svg`;
  const unpkg = `https://unpkg.com/simple-icons@latest/icons/${slug}.svg`;
  return [devicon, unpkg];
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
          <PoweredBadge />
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
            <span className="inline-block animate-fade-in">Code, run, and ship —</span>
            <span className="block bg-gradient-to-r from-primary via-fuchsia-500 to-cyan-400 bg-clip-text text-transparent animate-[shimmer_6s_linear_infinite] bg-[length:200%_auto]">
              from your browser.
            </span>
          </h1>
          <style>{`@keyframes shimmer{to{background-position:200% center}}`}</style>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Three playgrounds in one: a multi-language code runner, a live HTML/CSS/JS sandbox,
            and mobile starters that export to Android, iOS &amp; Flutter.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="group relative overflow-hidden">
              <Link to="/playground">
                <Play className="mr-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                Launch playground
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="hover-scale">
              <Link to="/playground/web"><Globe className="mr-2 h-4 w-4" /> Try the web sandbox</Link>
            </Button>
          </div>

          {/* GitHub Star CTA */}
          <div className="mt-6 flex justify-center">
            <a
              href="https://github.com/Vishwajeetsrk/learnify-playground"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-2 text-sm font-medium text-foreground backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_8px_30px_hsl(var(--primary)/0.18)]"
            >
              <Github className="h-4 w-4 transition-transform group-hover:rotate-12" />
              <span className="h-px w-4 bg-border transition-colors group-hover:bg-primary/30" />
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 transition-transform group-hover:scale-110" />
              Star on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* 3D demo cards: Code · Web · Mobile */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-6 md:grid-cols-3" style={{ perspective: "1400px" }}>
          <DemoCard to="/playground" tint="from-sky-500/30 to-indigo-500/30"
            icon={<Code2 className="h-5 w-5" />} title="Code" subtitle="18+ languages · instant run">
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

          <DemoCard to="/playground/web" tint="from-fuchsia-500/30 to-rose-500/30"
            icon={<Globe className="h-5 w-5" />} title="Web" subtitle="Live HTML · CSS · JS preview">
            <div className="grid h-full grid-cols-3 gap-1.5">
              {["#F7DF1E", "#E34F26", "#1572B6"].map((c, i) => (
                <div key={i} className="rounded-md border border-border/60"
                     style={{ background: `linear-gradient(135deg, ${c}30, transparent)` }} />
              ))}
              <div className="col-span-3 rounded-md border border-border/60 bg-background/40 px-2 py-1.5 font-mono text-[10px]">
                &lt;button class=&quot;btn&quot;&gt;Ship it&lt;/button&gt;
              </div>
            </div>
          </DemoCard>

          <DemoCard to="/playground/mobile" tint="from-emerald-500/30 to-cyan-500/30"
            icon={<Smartphone className="h-5 w-5" />} title="Mobile" subtitle="Android · iOS · Flutter export">
            <PhoneMock />
          </DemoCard>
        </div>
      </section>

      {/* Polyglot Orbit — interactive 3D logo carousel */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="h-3 w-3 text-primary" /> Polyglot Orbit
            </span>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Every language, real logos.</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Drag to spin · hover to pause · tap any logo to jump into the matching playground.
            </p>
          </div>
          <Link to="/tools" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            See all tools <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <LogoOrbit items={LANGS} />

        {/* Static grid below for full discoverability */}
        <div className="mt-12 grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
          {LANGS.map((l) => (
            <LogoTile key={l.slug} name={l.name} slug={l.slug} color={l.color} to={l.to} lang={l.lang} />
          ))}
        </div>
      </section>

      <ContributorsSection />
    </main>
  );
}

function ContributorsSection() {
  const { data, isLoading, isError } = useContributors(8);
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
            <Users className="h-3 w-3 text-primary" /> Open source
          </span>
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Top contributors</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Built in the open on GitHub — huge thanks to everyone shipping commits.
          </p>
        </div>
        <a
          href={`${GITHUB_REPO_URL}/graphs/contributors`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          See all <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-card/40" />
          ))}
        </div>
      ) : isError || !data || data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
          Couldn't load contributors right now.{" "}
          <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            View on GitHub
          </a>.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {data.map((c) => (
            <a
              key={c.id}
              href={c.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-2xl border border-border bg-card/70 p-3 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_8px_30px_hsl(var(--primary)/0.18)]"
            >
              <img
                src={`${c.avatar_url}&s=96`}
                alt={`${c.login} avatar`}
                width={48}
                height={48}
                loading="lazy"
                className="h-12 w-12 shrink-0 rounded-full ring-2 ring-border transition-all group-hover:ring-primary/60"
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">@{c.login}</div>
                <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <GitCommit className="h-3 w-3" />
                  {c.contributions} commit{c.contributions === 1 ? "" : "s"}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------------- Components ---------------- */

function PoweredBadge() {
  return (
    <span className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_8px_30px_hsl(var(--primary)/0.18)]">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <Cpu className="h-3 w-3 text-primary transition-transform group-hover:rotate-12" />
      Powered by Piston
      <span className="opacity-40">·</span>
      <Sparkles className="h-3 w-3 text-fuchsia-400 transition-transform group-hover:scale-110" />
      Monaco
      <span className="opacity-40">·</span>
      <Zap className="h-3 w-3 text-amber-400 transition-transform group-hover:-rotate-12" />
      AI Gateway
    </span>
  );
}

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

function InitialsBadge({ name, color, size }: { name: string; color: string; size: number }) {
  const initials = name.replace(/[^A-Za-z0-9+#]/g, "").slice(0, 2).toUpperCase() || "•";
  return (
    <span
      aria-label={`${name} logo`}
      role="img"
      style={{
        width: size, height: size, background: `linear-gradient(135deg, ${color}, ${color}AA)`,
        color: "#fff", fontSize: Math.max(10, Math.floor(size * 0.4)),
      }}
      className="inline-flex select-none items-center justify-center rounded-md font-bold tracking-tight shadow-inner"
    >
      {initials}
    </span>
  );
}

function SmartLogo({ slug, name, size = 32, color = "#7e5bff", className }: { slug: string; name: string; size?: number; color?: string; className?: string }) {
  const sources = [logoUrl(slug), ...logoFallbacks(slug)];
  const [idx, setIdx] = useState(0);
  // exhausted all CDN options → render an SVG initials badge so a tile is NEVER blank
  if (idx >= sources.length) {
    return <span className={className} style={{ display: "inline-flex" }}><InitialsBadge name={name} color={color} size={size} /></span>;
  }
  return (
    <img
      src={sources[idx]}
      alt={`${name} logo`}
      loading="lazy"
      width={size}
      height={size}
      className={className}
      draggable={false}
      onError={() => setIdx((i) => i + 1)}
    />
  );
}

function LogoTile({ name, slug, color, to, lang }: { name: string; slug: string; color: string; to: string; lang?: string }) {
  return (
    <Link
      to={lang ? `${to}?lang=${encodeURIComponent(lang)}` : to}
      className="group relative flex aspect-square items-center justify-center rounded-xl border border-border bg-card/70 p-3 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
      style={{ transformStyle: "preserve-3d" }}
      title={name}
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10 rounded-xl opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-70"
        style={{ background: `radial-gradient(closest-side, ${color}55, transparent 70%)` }}
      />
      <SmartLogo
        slug={slug}
        name={name}
        color={color}
        size={40}
        className="h-10 w-10 transition-transform duration-500 group-hover:[transform:rotateY(360deg)_scale(1.1)]"
      />
      <span className="absolute bottom-1 left-0 right-0 text-center text-[10px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
        {name}
      </span>
    </Link>
  );
}

/* -------- Polyglot Orbit: 3D, interactive, touch-friendly -------- */

function LogoOrbit({ items }: { items: { name: string; slug: string; color: string; to: string; lang?: string }[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef({
    rotY: 0,
    velocity: 0.15,
    tiltX: -8,
    tiltY: 0,
    targetTiltX: -8,
    targetTiltY: 0,
    paused: false,
    pointerDown: false,
    dragging: false,
    isTouch: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastT: 0,
    pointerId: -1,
  });

  const [radius, setRadius] = useState(260);

  useEffect(() => {
    const compute = () => {
      const w = wrapRef.current?.clientWidth ?? 640;
      setRadius(Math.max(140, Math.min(280, w * 0.42)));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  // Animation loop with snap-when-close so logos stay clickable
  useEffect(() => {
    const tick = () => {
      const s = stateRef.current;
      if (!s.dragging && !s.paused) s.rotY += s.velocity;
      const ex = s.targetTiltX - s.tiltX;
      const ey = s.targetTiltY - s.tiltY;
      s.tiltX = Math.abs(ex) < 0.05 ? s.targetTiltX : s.tiltX + ex * 0.12;
      s.tiltY = Math.abs(ey) < 0.05 ? s.targetTiltY : s.tiltY + ey * 0.12;
      if (ringRef.current) {
        ringRef.current.style.transform =
          `rotateX(${s.tiltX.toFixed(2)}deg) rotateY(${s.rotY.toFixed(2)}deg) rotateZ(${s.tiltY.toFixed(2)}deg)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => { stateRef.current.velocity = mq.matches ? 0 : 0.15; };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Touch needs a much larger threshold than mouse so a fingertip tap is never
  // mis-classified as a drag. Mouse can be tighter for responsive flicks.
  const dragThreshold = (isTouch: boolean) => (isTouch ? 14 : 6);

  const onPointerMove = (e: React.PointerEvent) => {
    const s = stateRef.current;
    // Parallax tilt only for fine pointers (mouse). Touch would jitter logos.
    if (e.pointerType === "mouse") {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (rect) {
        const cx = (e.clientX - rect.left) / rect.width - 0.5;
        const cy = (e.clientY - rect.top) / rect.height - 0.5;
        s.targetTiltX = -8 + cy * 10;
        s.targetTiltY = cx * 4;
      }
    }
    if (s.pointerDown) {
      if (!s.dragging) {
        const dx0 = e.clientX - s.startX;
        const dy0 = e.clientY - s.startY;
        if (Math.hypot(dx0, dy0) > dragThreshold(s.isTouch)) {
          s.dragging = true;
          try { (e.currentTarget as HTMLElement).setPointerCapture(s.pointerId); } catch {}
        }
      }
      if (s.dragging) {
        const now = performance.now();
        const dx = e.clientX - s.lastX;
        const dt = Math.max(1, now - s.lastT);
        s.rotY += dx * 0.4;
        s.velocity = (dx / dt) * 6;
        s.lastX = e.clientX;
        s.lastT = now;
      }
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const s = stateRef.current;
    s.pointerDown = true;
    s.dragging = false;
    s.isTouch = e.pointerType !== "mouse";
    s.startX = s.lastX = e.clientX;
    s.startY = e.clientY;
    s.lastT = performance.now();
    s.pointerId = e.pointerId;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = stateRef.current;
    const wasDragging = s.dragging;
    s.pointerDown = false;
    s.dragging = false;
    if (wasDragging) e.preventDefault();   // suppress synthetic click after a real drag
    const baseline = 0.15;
    const decay = () => {
      s.velocity = s.velocity * 0.94 + baseline * 0.06;
      if (Math.abs(s.velocity - baseline) > 0.01) requestAnimationFrame(decay);
      else s.velocity = baseline;
    };
    decay();
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };
  const onEnter = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") stateRef.current.paused = true;
  };
  const onLeave = (e: React.PointerEvent) => {
    const s = stateRef.current;
    if (e.pointerType === "mouse") s.paused = false;
    s.targetTiltX = -8;
    s.targetTiltY = 0;
  };

  const step = 360 / items.length;

  return (
    <div
      ref={wrapRef}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      className="relative mx-auto h-[360px] w-full max-w-[680px] touch-pan-y select-none"
      style={{ perspective: "1200px", cursor: "grab" }}
      role="region"
      data-testid="polyglot-orbit"
      aria-label="Polyglot Orbit — interactive 3D language carousel"
    >
      {/* Floor glow */}
      <div
        aria-hidden
        className="absolute left-1/2 top-[68%] -z-10 h-[80px] w-[460px] -translate-x-1/2 rounded-[50%] opacity-50 blur-2xl"
        style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.45), transparent 70%)" }}
      />
      <div
        ref={ringRef}
        className="absolute left-1/2 top-1/2 h-0 w-0 will-change-transform"
        style={{ transformStyle: "preserve-3d" }}
      >
        {items.map((it, i) => {
          const angle = i * step;
          return (
            <Link
              key={it.slug}
              to={it.lang ? `${it.to}?lang=${encodeURIComponent(it.lang)}` : it.to}
              draggable={false}
              data-testid={`orbit-logo-${it.slug}`}
              data-orbit-link="true"
              title={`${it.name} — open playground`}
              className="group absolute -left-8 -top-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card/90 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur transition-colors hover:border-primary"
              style={{
                transform: `rotateY(${angle}deg) translateZ(${radius}px)`,
                transformStyle: "preserve-3d",
              }}
            >
              {/* Brand-colored halo */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 rounded-2xl opacity-60 blur-md transition-opacity group-hover:opacity-100"
                style={{ background: `radial-gradient(closest-side, ${it.color}66, transparent 70%)` }}
              />
              {/* Glass highlight */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0) 55%)" }}
              />
              {/* Reflection pedestal */}
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-3 left-1/2 h-2 w-10 -translate-x-1/2 rounded-[50%] opacity-50 blur-md"
                style={{ background: it.color }}
              />
              <SmartLogo
                slug={it.slug}
                name={it.name}
                color={it.color}
                size={34}
                className="h-9 w-9 transition-transform duration-300 group-hover:scale-110"
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

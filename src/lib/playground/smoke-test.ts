// One-click smoke test: mounts every template in a hidden sandboxed iframe and
// collects runtime errors, console warnings, asset 404s and "auto-recovered"
// SecurityError events surfaced by the preview bridge.
//
// Web and mobile templates are reported as separate platforms so failures can
// be tracked independently. Diff and summary helpers power the IDE UI for
// comparing runs and grouping error categories.
import { buildPreviewDoc } from "./web-bundle";
import { WEB_TEMPLATES } from "./templates";
import { MULTI_TEMPLATES } from "./multi-templates";

export type SmokePlatform = "web" | "mobile";

export interface SmokeResult {
  id: string;
  name: string;
  platform: SmokePlatform;
  kind: "web" | "multi-web" | "mobile-native";
  errors: string[];
  warnings: string[];
  recovered: string[];
  assetFailures: string[];
  ok: boolean;
  durationMs: number;
  ranAt: number;
  /** True for native mobile templates that can only be statically inspected. */
  staticOnly?: boolean;
}

export interface SmokeRun {
  startedAt: number;
  finishedAt: number;
  results: SmokeResult[];
}

export interface SmokeSummary {
  total: number;
  passed: number;
  failed: number;
  passRate: number; // 0..1
  byPlatform: Record<SmokePlatform, { total: number; passed: number; failed: number }>;
  topCategories: { category: string; count: number }[];
  lastRunAt: number | null;
}

interface Candidate {
  id: string;
  name: string;
  platform: SmokePlatform;
  kind: SmokeResult["kind"];
  html: string;
  css: string;
  js: string;
  staticOnly?: boolean;
  /** For native mobile templates, the entry file path we expect to exist. */
  entryFile?: string;
  fileCount?: number;
}

function collectCandidates(): Candidate[] {
  const out: Candidate[] = [];
  for (const t of WEB_TEMPLATES) {
    out.push({
      id: t.id, name: t.name, platform: "web", kind: "web",
      html: t.files.html, css: t.files.css, js: t.files.js,
    });
  }
  for (const t of MULTI_TEMPLATES) {
    const isMobile = t.tracks.includes("mobile");
    const platform: SmokePlatform = isMobile ? "mobile" : "web";
    const html = t.files.find((f) => /(^|\/)index\.html?$/i.test(f.path));
    if (html) {
      const css = t.files.filter((f) => f.path.toLowerCase().endsWith(".css"))
        .map((f) => `/* ${f.path} */\n${f.content}`).join("\n\n");
      const js = t.files.filter((f) => f.path.toLowerCase().endsWith(".js"))
        .map((f) => `// ${f.path}\n${f.content}`).join("\n;\n");
      out.push({
        id: t.id, name: t.name, platform,
        kind: platform === "mobile" ? "multi-web" : "multi-web",
        html: html.content, css, js,
      });
    } else if (isMobile) {
      // Native mobile (Kotlin / Swift / Flutter). Can't run in iframe — do a
      // static sanity check that an entry file exists.
      const entry = t.activePath ?? t.files[0]?.path ?? "";
      out.push({
        id: t.id, name: t.name, platform: "mobile", kind: "mobile-native",
        html: "", css: "", js: "",
        staticOnly: true, entryFile: entry, fileCount: t.files.length,
      });
    }
  }
  return out;
}

const ASSET_RE = /(GET|fetch|load|404|Not Found|Failed to load|net::|Loading (?:CSS|module|chunk)|MIME type)/i;
const SECURITY_RE = /SecurityError|sandboxed|allow-same-origin/i;
const SYNTAX_RE = /SyntaxError|Unexpected (?:token|identifier|end)/i;
const REFERENCE_RE = /ReferenceError|is not defined/i;
const TYPE_RE = /TypeError|is not a function|Cannot read prop|undefined is not/i;
const NETWORK_RE = /NetworkError|Failed to fetch|ERR_|CORS|blocked by/i;

export function categorizeError(msg: string): string {
  if (SECURITY_RE.test(msg)) return "Security / sandbox";
  if (ASSET_RE.test(msg)) return "Asset 404 / load";
  if (SYNTAX_RE.test(msg)) return "Syntax";
  if (REFERENCE_RE.test(msg)) return "Reference";
  if (TYPE_RE.test(msg)) return "Type";
  if (NETWORK_RE.test(msg)) return "Network";
  return "Runtime";
}

export interface RunOpts {
  platforms?: SmokePlatform[];
  onlyIds?: string[];
  onProgress?: (done: number, total: number, current: string) => void;
}

export async function runSmokeTest(opts?: RunOpts | RunOpts["onProgress"]): Promise<SmokeResult[]> {
  // Back-compat: previously accepted a bare onProgress callback.
  const normalized: RunOpts = typeof opts === "function" ? { onProgress: opts } : (opts ?? {});
  const { platforms, onlyIds, onProgress } = normalized;
  let candidates = collectCandidates();
  if (platforms?.length) candidates = candidates.filter((c) => platforms.includes(c.platform));
  if (onlyIds?.length) {
    const set = new Set(onlyIds);
    candidates = candidates.filter((c) => set.has(c.id));
  }
  const results: SmokeResult[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    onProgress?.(i, candidates.length, c.name);
    results.push(await runOne(c));
  }
  onProgress?.(candidates.length, candidates.length, "");
  return results;
}

function runOne(c: Candidate): Promise<SmokeResult> {
  const startedAt = Date.now();
  // Native mobile: synthetic static check, returns instantly.
  if (c.staticOnly) {
    const ok = !!c.entryFile && (c.fileCount ?? 0) > 0;
    return Promise.resolve({
      id: c.id, name: c.name, platform: c.platform, kind: c.kind,
      errors: ok ? [] : ["Missing entry file in mobile template"],
      warnings: [], recovered: [], assetFailures: [],
      ok, durationMs: Date.now() - startedAt, ranAt: startedAt, staticOnly: true,
    });
  }
  return new Promise((resolve) => {
    const doc = buildPreviewDoc({ html: c.html, css: c.css, js: c.js });
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.style.cssText =
      "position:fixed;left:-9999px;top:-9999px;width:420px;height:420px;border:0;visibility:hidden;";
    iframe.srcdoc = doc;
    const errors: string[] = [];
    const warnings: string[] = [];
    const recovered: string[] = [];
    const assetFailures: string[] = [];
    const onMsg = (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow) return;
      const d = e.data as {
        __pgConsole?: boolean; level?: string; args?: unknown[];
        __pgRecover?: boolean; kind?: string; detail?: string;
      };
      if (d?.__pgConsole) {
        const text = Array.isArray(d.args) ? d.args.map(String).join(" ") : "";
        if (d.level === "error") {
          if (ASSET_RE.test(text)) assetFailures.push(text);
          else errors.push(text);
        } else if (d.level === "warn") warnings.push(text);
      } else if (d?.__pgRecover) {
        recovered.push(`${d.kind ?? "recover"}: ${d.detail ?? ""}`);
      }
    };
    window.addEventListener("message", onMsg);
    document.body.appendChild(iframe);
    setTimeout(() => {
      window.removeEventListener("message", onMsg);
      try { iframe.remove(); } catch { /* noop */ }
      resolve({
        id: c.id, name: c.name, platform: c.platform, kind: c.kind,
        errors, warnings, recovered, assetFailures,
        ok: errors.length === 0 && assetFailures.length === 0,
        durationMs: Date.now() - startedAt, ranAt: startedAt,
      });
    }, 1400);
  });
}

// --------------------------------------------------------------------------
// Summary + diff helpers

export function summarize(results: SmokeResult[], lastRunAt: number | null = null): SmokeSummary {
  const byPlatform: SmokeSummary["byPlatform"] = {
    web: { total: 0, passed: 0, failed: 0 },
    mobile: { total: 0, passed: 0, failed: 0 },
  };
  const catCount = new Map<string, number>();
  let passed = 0;
  for (const r of results) {
    byPlatform[r.platform].total += 1;
    if (r.ok) { passed += 1; byPlatform[r.platform].passed += 1; }
    else byPlatform[r.platform].failed += 1;
    for (const e of [...r.errors, ...r.assetFailures]) {
      const cat = categorizeError(e);
      catCount.set(cat, (catCount.get(cat) ?? 0) + 1);
    }
  }
  const topCategories = [...catCount.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: results.length ? passed / results.length : 0,
    byPlatform,
    topCategories,
    lastRunAt: lastRunAt ?? (results[0]?.ranAt ?? null),
  };
}

export interface SmokeDiffEntry {
  id: string;
  name: string;
  platform: SmokePlatform;
  status: "regressed" | "recovered" | "still-failing" | "still-passing" | "new" | "removed";
  newErrors: string[];      // errors present now, absent before
  fixedErrors: string[];    // errors present before, absent now
  newAssetFailures: string[];
  fixedAssetFailures: string[];
}

export interface SmokeDiff {
  entries: SmokeDiffEntry[];
  regressed: SmokeDiffEntry[];
  recovered: SmokeDiffEntry[];
  changed: SmokeDiffEntry[]; // any entry whose errors/asset lists differ
}

export function diffRuns(prev: SmokeResult[] | null, curr: SmokeResult[]): SmokeDiff {
  const prevMap = new Map<string, SmokeResult>();
  prev?.forEach((r) => prevMap.set(r.id, r));
  const seen = new Set<string>();
  const entries: SmokeDiffEntry[] = [];

  for (const r of curr) {
    seen.add(r.id);
    const p = prevMap.get(r.id);
    if (!p) {
      entries.push({
        id: r.id, name: r.name, platform: r.platform,
        status: r.ok ? "still-passing" : "regressed",
        newErrors: r.errors, fixedErrors: [],
        newAssetFailures: r.assetFailures, fixedAssetFailures: [],
      });
      continue;
    }
    const newErrors = diffStrings(r.errors, p.errors);
    const fixedErrors = diffStrings(p.errors, r.errors);
    const newAssetFailures = diffStrings(r.assetFailures, p.assetFailures);
    const fixedAssetFailures = diffStrings(p.assetFailures, r.assetFailures);
    let status: SmokeDiffEntry["status"];
    if (p.ok && !r.ok) status = "regressed";
    else if (!p.ok && r.ok) status = "recovered";
    else if (!p.ok && !r.ok) status = "still-failing";
    else status = "still-passing";
    entries.push({
      id: r.id, name: r.name, platform: r.platform, status,
      newErrors, fixedErrors, newAssetFailures, fixedAssetFailures,
    });
  }
  // Removed templates (existed before, gone now)
  prev?.forEach((p) => {
    if (!seen.has(p.id)) {
      entries.push({
        id: p.id, name: p.name, platform: p.platform, status: "removed",
        newErrors: [], fixedErrors: p.errors,
        newAssetFailures: [], fixedAssetFailures: p.assetFailures,
      });
    }
  });

  const changed = entries.filter((e) =>
    e.newErrors.length || e.fixedErrors.length ||
    e.newAssetFailures.length || e.fixedAssetFailures.length ||
    e.status === "regressed" || e.status === "recovered",
  );
  return {
    entries,
    regressed: entries.filter((e) => e.status === "regressed"),
    recovered: entries.filter((e) => e.status === "recovered"),
    changed,
  };
}

function diffStrings(a: string[], b: string[]): string[] {
  const bset = new Set(b);
  return a.filter((s) => !bset.has(s));
}

/** Merge a partial re-run (e.g. retry of failed templates) back into a full run. */
export function mergeResults(base: SmokeResult[], updates: SmokeResult[]): SmokeResult[] {
  const map = new Map(base.map((r) => [r.id, r] as const));
  for (const u of updates) map.set(u.id, u);
  return [...map.values()];
}

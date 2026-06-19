// File-relationship engine for Playground.
// Parses the current file set and returns a dependency graph plus a list of
// broken references. Pure functions, no React, no I/O.

export type EdgeKind =
  | "html-css" | "html-js" | "html-asset" | "html-iframe"
  | "css-import" | "css-asset"
  | "js-import" | "js-fetch" | "js-asset"
  | "mobile-asset" | "sql-table";

export interface RelFile {
  path: string;
  content?: string;
  isAsset?: boolean;
}

export interface Edge {
  from: string;            // source file path
  to: string;              // resolved target path or raw target if unresolved
  kind: EdgeKind;
  raw: string;             // raw href/src as written
  resolved: boolean;       // false ⇒ broken link
  line?: number;
}

export interface Graph {
  nodes: string[];
  edges: Edge[];
  broken: Edge[];
}

const RX = {
  htmlLink:   /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi,
  htmlScript: /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi,
  htmlImg:    /<(?:img|video|audio|source|iframe)\b[^>]*\b(?:src|href|poster)\s*=\s*["']([^"']+)["']/gi,
  cssImport:  /@import\s+(?:url\()?["']?([^"')]+)["']?\)?/gi,
  cssUrl:     /url\(\s*["']?([^"')]+)["']?\s*\)/gi,
  jsImport:   /(?:import\s+[^"']*?from\s+|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g,
  jsFetch:    /\bfetch\s*\(\s*["']([^"']+)["']/g,
  jsNewUrl:   /new\s+URL\s*\(\s*["']([^"']+)["']/g,
  // Mobile asset references — best-effort
  kotlinDrawable: /R\.drawable\.([A-Za-z0-9_]+)/g,
  swiftImage:     /Image\s*\(\s*["']([^"']+)["']/g,
  flutterAsset:   /AssetImage\s*\(\s*["']([^"']+)["']/g,
  // SQL table references
  sqlTable:       /\b(?:from|join|update|into)\s+([A-Za-z_][A-Za-z0-9_]*)/gi,
};

function isExternal(u: string): boolean {
  return /^([a-z]+:)?\/\//i.test(u) || u.startsWith("data:") || u.startsWith("blob:") || u.startsWith("#") || u.startsWith("mailto:");
}

function dirname(p: string): string {
  const i = p.lastIndexOf("/");
  return i < 0 ? "" : p.slice(0, i);
}

function normalize(p: string): string {
  const parts: string[] = [];
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

/** Resolve a referenced path (relative or root-relative) against the file set. */
function resolveRef(from: string, ref: string, files: RelFile[]): string | null {
  const r = ref.split("?")[0].split("#")[0];
  if (!r) return null;
  const candidates: string[] = [];
  if (r.startsWith("/")) {
    candidates.push(normalize(r.slice(1)));
  } else {
    candidates.push(normalize(`${dirname(from)}/${r}`));
  }
  candidates.push(normalize(r));
  // also try basename match for mobile-style "logo" lookups
  const base = r.split("/").pop()!;
  for (const cand of candidates) {
    const hit = files.find((f) => f.path === cand);
    if (hit) return hit.path;
  }
  // fuzzy: any file whose basename (sans ext) matches `r`
  const fuzzy = files.find((f) => {
    const b = f.path.split("/").pop()!;
    return b === base || b.replace(/\.[^.]+$/, "") === r;
  });
  return fuzzy?.path ?? null;
}

function ext(p: string): string {
  const m = p.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

function pushEdge(out: Edge[], from: string, ref: string, kind: EdgeKind, files: RelFile[]) {
  if (isExternal(ref)) return;
  const resolved = resolveRef(from, ref, files);
  out.push({ from, to: resolved ?? ref, kind, raw: ref, resolved: !!resolved });
}

function scanHtml(file: RelFile, files: RelFile[], edges: Edge[]) {
  const src = file.content ?? "";
  for (const m of src.matchAll(RX.htmlLink))   pushEdge(edges, file.path, m[1], "html-css", files);
  for (const m of src.matchAll(RX.htmlScript)) pushEdge(edges, file.path, m[1], "html-js", files);
  for (const m of src.matchAll(RX.htmlImg)) {
    const ref = m[1];
    const kind: EdgeKind = /<iframe/i.test(m[0]) ? "html-iframe" : "html-asset";
    pushEdge(edges, file.path, ref, kind, files);
  }
}

function scanCss(file: RelFile, files: RelFile[], edges: Edge[]) {
  const src = file.content ?? "";
  for (const m of src.matchAll(RX.cssImport)) pushEdge(edges, file.path, m[1], "css-import", files);
  for (const m of src.matchAll(RX.cssUrl))    pushEdge(edges, file.path, m[1], "css-asset", files);
}

function scanJs(file: RelFile, files: RelFile[], edges: Edge[]) {
  const src = file.content ?? "";
  for (const m of src.matchAll(RX.jsImport)) pushEdge(edges, file.path, m[1], "js-import", files);
  for (const m of src.matchAll(RX.jsFetch))  pushEdge(edges, file.path, m[1], "js-fetch", files);
  for (const m of src.matchAll(RX.jsNewUrl)) pushEdge(edges, file.path, m[1], "js-asset", files);
}

function scanMobile(file: RelFile, files: RelFile[], edges: Edge[]) {
  const src = file.content ?? "";
  const e = ext(file.path);
  if (e === "kt" || e === "java") {
    for (const m of src.matchAll(RX.kotlinDrawable)) pushEdge(edges, file.path, m[1], "mobile-asset", files);
  } else if (e === "swift") {
    for (const m of src.matchAll(RX.swiftImage)) pushEdge(edges, file.path, m[1], "mobile-asset", files);
  } else if (e === "dart") {
    for (const m of src.matchAll(RX.flutterAsset)) pushEdge(edges, file.path, m[1], "mobile-asset", files);
  }
}

function scanSql(file: RelFile, files: RelFile[], edges: Edge[]) {
  const src = file.content ?? "";
  const tables = new Set<string>();
  for (const m of src.matchAll(RX.sqlTable)) tables.add(m[1].toLowerCase());
  for (const t of tables) {
    const hit = files.find((f) => ext(f.path) === "sql" && f.path !== file.path && new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?${t}\\b`, "i").test(f.content ?? ""));
    if (hit) edges.push({ from: file.path, to: hit.path, kind: "sql-table", raw: t, resolved: true });
  }
}

export function buildGraph(files: RelFile[]): Graph {
  const edges: Edge[] = [];
  for (const f of files) {
    if (f.isAsset) continue;
    const e = ext(f.path);
    if (e === "html" || e === "htm") scanHtml(f, files, edges);
    else if (e === "css") scanCss(f, files, edges);
    else if (e === "js" || e === "ts" || e === "jsx" || e === "tsx" || e === "mjs") scanJs(f, files, edges);
    else if (e === "sql") scanSql(f, files, edges);
    else if (e === "kt" || e === "java" || e === "swift" || e === "dart") scanMobile(f, files, edges);
  }
  return {
    nodes: files.map((f) => f.path),
    edges,
    broken: edges.filter((e) => !e.resolved),
  };
}

export interface RewriteResult {
  files: RelFile[];
  changedFiles: string[];
}

/** Rewrite every reference to `oldPath` so it points at `newPath`. */
export function renameReferences(files: RelFile[], oldPath: string, newPath: string): RewriteResult {
  const g = buildGraph(files);
  const refsByFrom = new Map<string, Edge[]>();
  for (const e of g.edges) {
    if (e.to !== oldPath) continue;
    const arr = refsByFrom.get(e.from) ?? [];
    arr.push(e);
    refsByFrom.set(e.from, arr);
  }
  const changedFiles: string[] = [];
  const next = files.map((f) => {
    const edges = refsByFrom.get(f.path);
    if (!edges || !f.content) return f;
    let src = f.content;
    for (const e of edges) {
      // Compute the relative form to write back
      const relNew = relativePath(f.path, newPath);
      // Replace exact raw occurrences only; safer than regex.
      const needle = e.raw;
      if (src.includes(needle)) {
        src = src.split(needle).join(relNew);
      }
    }
    if (src !== f.content) {
      changedFiles.push(f.path);
      return { ...f, content: src };
    }
    return f;
  });
  return { files: next, changedFiles };
}

function relativePath(from: string, to: string): string {
  const fp = from.split("/").slice(0, -1);
  const tp = to.split("/");
  let i = 0;
  while (i < fp.length && i < tp.length - 1 && fp[i] === tp[i]) i++;
  const ups = fp.length - i;
  const rest = tp.slice(i).join("/");
  if (ups === 0) return rest.startsWith("./") ? rest : `./${rest}`;
  return `${"../".repeat(ups)}${rest}`;
}

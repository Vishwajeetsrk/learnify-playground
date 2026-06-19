// Build a sandboxed HTML document from project files and inject a console bridge
// so the parent window can capture console.log/info/warn/error messages.
export interface WebFiles {
  html: string;
  css: string;
  js: string;
  /** Map of asset path/filename -> data URL. Used to rewrite asset references. */
  assets?: Record<string, string>;
  /** Seed snapshot for the iframe's shimmed local/session storage. */
  storageSeed?: { local?: Record<string, string>; session?: Record<string, string> };
}

export const PREVIEW_VIEWPORTS = {
  fit:     { label: "Fit",     w: 0,    h: 0    },
  mobile:  { label: "Mobile",  w: 375,  h: 667  },
  tablet:  { label: "Tablet",  w: 768,  h: 1024 },
  desktop: { label: "Desktop", w: 1280, h: 800  },
} as const;
export type ViewportKey = keyof typeof PREVIEW_VIEWPORTS;




function buildBridge(seed: { local: Record<string, string>; session: Record<string, string> }): string {
  const seedJson = JSON.stringify(seed).replace(/</g, "\\u003c");
  return `<script>
(function(){
  var __seed = ${seedJson};
  // Shim localStorage/sessionStorage: the preview iframe runs without
  // 'allow-same-origin', so the real Storage APIs throw SecurityError.
  // We provide an in-memory implementation, seeded from a snapshot the
  // parent persists, and report every mutation back so the parent can
  // sync the snapshot across reloads.
  function makeStorage(kind, initial){
    var map = Object.create(null);
    if (initial) for (var k in initial) map[k] = String(initial[k]);
    function sync(){
      try {
        var snap = {}; for (var k in map) snap[k] = map[k];
        parent.postMessage({ __pgStorage: true, kind: kind, snapshot: snap }, '*');
      } catch(e){}
    }
    return {
      get length(){ return Object.keys(map).length; },
      key: function(i){ return Object.keys(map)[i] || null; },
      getItem: function(k){ return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
      setItem: function(k, v){ map[String(k)] = String(v); sync(); },
      removeItem: function(k){ delete map[k]; sync(); },
      clear: function(){ map = Object.create(null); sync(); },
    };
  }
  try {
    Object.defineProperty(window, 'localStorage',   { value: makeStorage('local',   __seed.local),   configurable: true });
    Object.defineProperty(window, 'sessionStorage', { value: makeStorage('session', __seed.session), configurable: true });
  } catch(e){}

  function send(level, args){
    try { parent.postMessage({ __pgConsole:true, level, args: args.map(a => {
      try { return typeof a === 'string' ? a : JSON.stringify(a); }
      catch { return String(a); }
    }) }, '*'); } catch(e){}
  }
  ['log','info','warn','error','debug'].forEach(function(lvl){
    var orig = console[lvl] && console[lvl].bind(console);
    console[lvl] = function(){ var args = Array.prototype.slice.call(arguments);
      if (orig) orig.apply(null, args); send(lvl, args); };
  });
  window.addEventListener('error', function(e){
    var loc = e.filename ? ' (' + (e.filename.replace('about:srcdoc','preview')) + ':' + e.lineno + ':' + (e.colno||0) + ')' : '';
    send('error', [(e.message || 'Error') + loc]);
  });
  window.addEventListener('unhandledrejection', function(e){
    send('error', ['Unhandled promise: ' + (e.reason && e.reason.message || e.reason)]);
  });
})();
</script>`;
}

/** Rewrite occurrences of an asset filename to its data URL inside HTML/CSS text. */
function rewriteAssets(input: string, assets: Record<string, string>): string {
  if (!input || !assets) return input;
  let out = input;
  // Longest paths first so "assets/logo.png" wins over "logo.png".
  const keys = Object.keys(assets).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (!key) continue;
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Match in src="...", href="...", url(...), with or without ./ prefix.
    const re = new RegExp(`(["'(\\s=])(?:\\./)?${escaped}(?=["')\\s>])`, "g");
    out = out.replace(re, (_m, lead) => `${lead}${assets[key]}`);
  }
  return out;
}

export function buildPreviewDoc({ html, css, js, assets, storageSeed }: WebFiles): string {
  const a = assets ?? {};
  const bridge = buildBridge({
    local:   storageSeed?.local   ?? {},
    session: storageSeed?.session ?? {},
  });
  let htmlOut = rewriteAssets(html, a);
  const cssOut = rewriteAssets(css, a);
  // Remove <link rel="stylesheet" href="*.css"> and <script src="*.js">
  // tags pointing at LOCAL files — those resolve to nothing inside an
  // srcDoc iframe (no http origin), and we inline the same content below.
  // Keep external http(s):// and data: URLs intact.
  htmlOut = htmlOut.replace(
    /<link[^>]+rel=["']?stylesheet["']?[^>]*href=["']([^"']+)["'][^>]*>\s*/gi,
    (m, href) => (/^(https?:|\/\/|data:)/i.test(href) ? m : ""),
  );
  htmlOut = htmlOut.replace(
    /<script[^>]+src=["']([^"']+)["'][^>]*>\s*<\/script>\s*/gi,
    (m, src) => (/^(https?:|\/\/|data:)/i.test(src) ? m : ""),
  );
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Preview</title>
${bridge}
<style>${cssOut}</style>
</head>
<body>
${htmlOut}
<script>${js}</script>
</body>
</html>`;
}



export interface ConsoleMsg { level: string; text: string; at: number }

export function parseConsoleMessage(data: unknown): ConsoleMsg | null {
  if (!data || typeof data !== "object") return null;
  const d = data as { __pgConsole?: boolean; level?: string; args?: unknown[] };
  if (!d.__pgConsole) return null;
  return {
    level: String(d.level ?? "log"),
    text: Array.isArray(d.args) ? d.args.map(String).join(" ") : "",
    at: Date.now(),
  };
}

export interface StorageMsg { kind: "local" | "session"; snapshot: Record<string, string> }

export function parseStorageMessage(data: unknown): StorageMsg | null {
  if (!data || typeof data !== "object") return null;
  const d = data as { __pgStorage?: boolean; kind?: string; snapshot?: Record<string, string> };
  if (!d.__pgStorage) return null;
  const kind = d.kind === "session" ? "session" : "local";
  return { kind, snapshot: d.snapshot ?? {} };
}

// --------------------------------------------------------------------------
// Mobile / multi-file project overview preview.
// Renders a phone-frame "project overview" doc so users can see every source
// file and every asset wired together — the equivalent of the web preview
// for tracks that have no live runtime (Kotlin/Swift/Dart/etc.).

export interface ProjectFile {
  path: string;
  language?: string;
  content: string;
  asset?: { mime: string; dataUrl: string; size: number };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function buildProjectOverviewDoc(opts: {
  projectName: string;
  track: "mobile" | "code" | "web";
  files: ProjectFile[];
}): string {
  const { projectName, track, files } = opts;
  const sources = files.filter((f) => !f.asset);
  const assets = files.filter((f) => f.asset);
  const images = assets.filter((f) => f.asset!.mime.startsWith("image/"));
  const others = assets.filter((f) => !f.asset!.mime.startsWith("image/"));

  const entryGuess =
    sources.find((f) => /main\.(kt|swift|dart|js|ts|py)$/i.test(f.path)) ??
    sources.find((f) => /ContentView\.swift$|MainActivity\.kt$/i.test(f.path)) ??
    sources[0];

  const sourceBlocks = sources
    .map((f) => {
      const isEntry = f === entryGuess;
      const preview = f.content.split("\n").slice(0, 40).join("\n");
      const truncated = f.content.split("\n").length > 40;
      return `
        <details ${isEntry ? "open" : ""} class="file">
          <summary>
            <span class="path">${escapeHtml(f.path)}</span>
            <span class="meta">${f.content.split("\n").length} lines${isEntry ? " · entry" : ""}</span>
          </summary>
          <pre><code>${escapeHtml(preview)}${truncated ? "\n…" : ""}</code></pre>
        </details>`;
    })
    .join("");

  const imageGrid = images.length
    ? `<div class="grid">${images
        .map(
          (f) => `
        <figure>
          <img src="${f.asset!.dataUrl}" alt="${escapeHtml(f.path)}" loading="lazy" />
          <figcaption>
            <span class="name">${escapeHtml(f.path.split("/").pop()!)}</span>
            <span class="size">${fmtBytes(f.asset!.size)}</span>
          </figcaption>
        </figure>`,
        )
        .join("")}</div>`
    : `<p class="empty">No images uploaded yet — add files in the assets folder.</p>`;

  const otherList = others.length
    ? `<ul class="files">${others
        .map(
          (f) =>
            `<li><a href="${f.asset!.dataUrl}" download="${escapeHtml(f.path.split("/").pop()!)}">${escapeHtml(f.path)}</a><span>${fmtBytes(f.asset!.size)} · ${escapeHtml(f.asset!.mime)}</span></li>`,
        )
        .join("")}</ul>`
    : "";

  const trackLabel = track === "mobile" ? "Mobile project" : track === "code" ? "Code project" : "Web project";
  const bridge = buildBridge({ local: {}, session: {} });

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(projectName)}</title>
${bridge}
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #0b1020; color: #e8ecff;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  body { padding: 16px 14px 40px; max-width: 480px; margin: 0 auto; }
  header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
  .badge { font-size: 10px; letter-spacing: .08em; text-transform: uppercase;
    color: #9aa4d8; background: #161b35; padding: 4px 8px; border-radius: 999px; border: 1px solid #232a55; }
  h1 { font-size: 18px; margin: 0; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em;
    color: #9aa4d8; margin: 22px 0 8px; }
  .phone { border: 1px solid #2a3170; border-radius: 28px; background: #0e1430;
    padding: 18px 14px; box-shadow: 0 8px 30px rgba(0,0,0,.4); }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
  .stat { background: #11183a; border: 1px solid #232a55; border-radius: 12px;
    padding: 10px; text-align: center; }
  .stat b { display: block; font-size: 18px; color: #fff; }
  .stat span { font-size: 10px; color: #9aa4d8; text-transform: uppercase; letter-spacing: .06em; }
  .file { background: #0f1638; border: 1px solid #232a55; border-radius: 12px;
    padding: 8px 10px; margin-bottom: 8px; }
  .file summary { cursor: pointer; display: flex; justify-content: space-between;
    align-items: center; gap: 8px; font-size: 12px; }
  .file .path { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #e8ecff; }
  .file .meta { color: #9aa4d8; font-size: 10px; }
  .file pre { margin: 8px 0 0; padding: 10px; background: #060a1d; border-radius: 8px;
    overflow: auto; max-height: 240px; font-size: 11px; line-height: 1.5; color: #cdd6ff; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
  figure { margin: 0; background: #11183a; border: 1px solid #232a55; border-radius: 10px;
    overflow: hidden; }
  figure img { display: block; width: 100%; height: 100px; object-fit: cover; background: #060a1d; }
  figcaption { padding: 6px 8px; font-size: 10px; display: flex; justify-content: space-between;
    color: #9aa4d8; }
  figcaption .name { color: #e8ecff; max-width: 70%; overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap; }
  ul.files { list-style: none; padding: 0; margin: 0; }
  ul.files li { background: #11183a; border: 1px solid #232a55; border-radius: 10px;
    padding: 8px 10px; margin-bottom: 6px; display: flex; justify-content: space-between;
    align-items: center; gap: 8px; font-size: 12px; }
  ul.files a { color: #8ab4ff; text-decoration: none; }
  ul.files span { font-size: 10px; color: #9aa4d8; }
  .empty { color: #9aa4d8; font-size: 12px; text-align: center; padding: 16px; }
</style>
</head><body>
  <header>
    <span class="badge">${escapeHtml(trackLabel)}</span>
    <h1>${escapeHtml(projectName)}</h1>
  </header>
  <div class="phone">
    <div class="stats">
      <div class="stat"><b>${sources.length}</b><span>source files</span></div>
      <div class="stat"><b>${images.length}</b><span>images</span></div>
      <div class="stat"><b>${others.length}</b><span>docs</span></div>
    </div>
    <h2>Source files</h2>
    ${sourceBlocks || `<p class="empty">No source files yet.</p>`}
    <h2>Assets · images</h2>
    ${imageGrid}
    ${others.length ? `<h2>Assets · documents</h2>${otherList}` : ""}
  </div>
</body></html>`;
}

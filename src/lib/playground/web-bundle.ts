// Build a sandboxed HTML document from project files and inject a console bridge
// so the parent window can capture console.log/info/warn/error messages.
export interface WebFiles {
  html: string;
  css: string;
  js: string;
  /** Map of asset path/filename -> data URL. Used to rewrite asset references. */
  assets?: Record<string, string>;
}

export const PREVIEW_VIEWPORTS = {
  mobile:  { label: "Mobile",  w: 375,  h: 667  },
  tablet:  { label: "Tablet",  w: 768,  h: 1024 },
  desktop: { label: "Desktop", w: 1280, h: 800  },
} as const;
export type ViewportKey = keyof typeof PREVIEW_VIEWPORTS;

const BRIDGE = `<script>
(function(){
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
  window.addEventListener('error', function(e){ send('error', [e.message + (e.filename ? ' ('+e.filename+':'+e.lineno+')' : '')]); });
  window.addEventListener('unhandledrejection', function(e){ send('error', ['Unhandled promise: ' + (e.reason && e.reason.message || e.reason)]); });
})();
</script>`;

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

export function buildPreviewDoc({ html, css, js, assets }: WebFiles): string {
  const a = assets ?? {};
  const htmlOut = rewriteAssets(html, a);
  const cssOut = rewriteAssets(css, a);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Preview</title>
${BRIDGE}
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

// Build a sandboxed HTML document from project files and inject a console bridge
// so the parent window can capture console.log/info/warn/error messages.
export interface WebFiles { html: string; css: string; js: string }

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

export function buildPreviewDoc({ html, css, js }: WebFiles): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Preview</title>
${BRIDGE}
<style>${css}</style>
</head>
<body>
${html}
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

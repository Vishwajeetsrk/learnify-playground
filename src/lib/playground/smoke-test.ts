// One-click smoke test: builds the preview for every web-runnable template,
// mounts each in a hidden sandboxed iframe, and collects runtime errors,
// console warnings, and "auto-recovered" SecurityError events surfaced by the
// preview bridge.
import { buildPreviewDoc } from "./web-bundle";
import { WEB_TEMPLATES } from "./templates";
import { MULTI_TEMPLATES } from "./multi-templates";

export interface SmokeResult {
  id: string;
  name: string;
  kind: "web" | "multi-web";
  errors: string[];
  warnings: string[];
  recovered: string[];
  ok: boolean;
}

interface Candidate {
  id: string;
  name: string;
  kind: SmokeResult["kind"];
  html: string;
  css: string;
  js: string;
}

function collectCandidates(): Candidate[] {
  const out: Candidate[] = [];
  for (const t of WEB_TEMPLATES) {
    out.push({
      id: t.id, name: t.name, kind: "web",
      html: t.files.html, css: t.files.css, js: t.files.js,
    });
  }
  for (const t of MULTI_TEMPLATES) {
    const html = t.files.find((f) => /(^|\/)index\.html?$/i.test(f.path));
    if (!html) continue;
    const css = t.files.filter((f) => f.path.toLowerCase().endsWith(".css"))
      .map((f) => `/* ${f.path} */\n${f.content}`).join("\n\n");
    const js = t.files.filter((f) => f.path.toLowerCase().endsWith(".js"))
      .map((f) => `// ${f.path}\n${f.content}`).join("\n;\n");
    out.push({ id: t.id, name: t.name, kind: "multi-web", html: html.content, css, js });
  }
  return out;
}

export async function runSmokeTest(
  onProgress?: (done: number, total: number, current: string) => void,
): Promise<SmokeResult[]> {
  const candidates = collectCandidates();
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
    const onMsg = (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow) return;
      const d = e.data as {
        __pgConsole?: boolean; level?: string; args?: unknown[];
        __pgRecover?: boolean; kind?: string; detail?: string;
      };
      if (d?.__pgConsole) {
        const text = Array.isArray(d.args) ? d.args.map(String).join(" ") : "";
        if (d.level === "error") errors.push(text);
        else if (d.level === "warn") warnings.push(text);
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
        id: c.id, name: c.name, kind: c.kind,
        errors, warnings, recovered,
        ok: errors.length === 0,
      });
    }, 1400);
  });
}

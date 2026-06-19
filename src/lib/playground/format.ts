// Lazy-loaded code formatter. Prettier handles JS/TS/CSS/JSON/Markdown/YAML,
// sql-formatter handles SQL dialects. Callers should fall back to Monaco's
// built-in formatter when this returns null.

export type FormatLang =
  | "javascript" | "typescript" | "json" | "css" | "scss" | "less"
  | "markdown" | "yaml" | "sql" | "html" | "xml";

export function languageFromPath(path: string): FormatLang | null {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "js": case "jsx": case "mjs": case "cjs": return "javascript";
    case "ts": case "tsx": return "typescript";
    case "json": return "json";
    case "css": return "css";
    case "scss": return "scss";
    case "less": return "less";
    case "md": case "markdown": return "markdown";
    case "yml": case "yaml": return "yaml";
    case "sql": return "sql";
    case "html": case "htm": return "html";
    case "xml": case "svg": return "xml";
    default: return null;
  }
}

const PRETTIER_PARSER: Partial<Record<FormatLang, string>> = {
  javascript: "babel",
  typescript: "typescript",
  json: "json",
  css: "css",
  scss: "scss",
  less: "less",
  markdown: "markdown",
  yaml: "yaml",
};

/** Returns formatted source, or null when the language is not supported here
 * (caller should then fall back to Monaco). Never throws. */
export async function formatSource(lang: FormatLang, source: string): Promise<string | null> {
  try {
    if (lang === "sql") {
      const { format } = await import("sql-formatter");
      return format(source, { language: "sqlite", tabWidth: 2, keywordCase: "upper" });
    }
    const parser = PRETTIER_PARSER[lang];
    if (!parser) return null;
    const prettier = await import("prettier/standalone");
    const plugins = await loadPrettierPlugins(parser);
    return await prettier.format(source, {
      parser,
      plugins: plugins as never,
      tabWidth: 2, semi: true, singleQuote: false,
    });
  } catch (e) {
    console.warn("[format] failed", lang, e);
    return null;
  }
}

async function loadPrettierPlugins(parser: string): Promise<unknown[]> {
  const out: unknown[] = [];
  if (parser === "babel" || parser === "json") {
    out.push(await import("prettier/plugins/babel"));
    out.push(await import("prettier/plugins/estree"));
  } else if (parser === "typescript") {
    out.push(await import("prettier/plugins/typescript"));
    out.push(await import("prettier/plugins/estree"));
  } else if (parser === "css" || parser === "scss" || parser === "less") {
    out.push(await import("prettier/plugins/postcss"));
  } else if (parser === "markdown") {
    out.push(await import("prettier/plugins/markdown"));
  } else if (parser === "yaml") {
    out.push(await import("prettier/plugins/yaml"));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Format-on-Save preference (shared across playground routes).

const FOS_KEY = "playground:format-on-save:v1";
export function getFormatOnSave(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(FOS_KEY) === "1"; } catch { return false; }
}
export function setFormatOnSave(on: boolean): void {
  try { localStorage.setItem(FOS_KEY, on ? "1" : "0"); } catch { /* ignore */ }
}

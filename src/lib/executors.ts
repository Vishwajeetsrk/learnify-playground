// Free code execution providers (no API key required).
//
// - wandbox: https://wandbox.org/api  — primary, covers every language we expose
// - piston:  https://emkc.org/api/v2/piston — kept as a selectable fallback.
//   NOTE: The public Piston endpoint became whitelist-only in Feb 2026 and
//   will usually respond with HTTP 403 + an explanatory message. When that
//   happens we surface a clear error and (when fallback is enabled) retry
//   on Wandbox automatically.

export type LangKey =
  | "python"
  | "javascript"
  | "typescript"
  | "java"
  | "c"
  | "cpp"
  | "csharp"
  | "php"
  | "go"
  | "rust"
  | "ruby"
  | "bash";

export type ProviderKey = "wandbox" | "piston";

interface LangSpec {
  label: string;
  monaco: string;
  wandbox: { compiler: string };
  piston?: { language: string; version: string; filename: string };
  starter: string;
}

export const LANGUAGES: Record<LangKey, LangSpec> = {
  python: {
    label: "Python",
    monaco: "python",
    wandbox: { compiler: "cpython-3.14.0" },
    piston: { language: "python", version: "3.10.0", filename: "main.py" },
    starter: `print("Hello from Python")\n`,
  },
  javascript: {
    label: "JavaScript",
    monaco: "javascript",
    wandbox: { compiler: "nodejs-20.17.0" },
    piston: { language: "javascript", version: "18.15.0", filename: "main.js" },
    starter: `console.log("Hello from JavaScript");\n`,
  },
  typescript: {
    label: "TypeScript",
    monaco: "typescript",
    wandbox: { compiler: "typescript-5.6.2" },
    piston: { language: "typescript", version: "5.0.3", filename: "main.ts" },
    starter: `const msg: string = "Hello from TypeScript";\nconsole.log(msg);\n`,
  },
  java: {
    label: "Java",
    monaco: "java",
    wandbox: { compiler: "openjdk-jdk-22+36" },
    piston: { language: "java", version: "15.0.2", filename: "Main.java" },
    starter: `public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello from Java");\n  }\n}\n`,
  },
  c: {
    label: "C",
    monaco: "c",
    wandbox: { compiler: "gcc-13.2.0-c" },
    piston: { language: "c", version: "10.2.0", filename: "main.c" },
    starter: `#include <stdio.h>\nint main(){ printf("Hello from C\\n"); return 0; }\n`,
  },
  cpp: {
    label: "C++",
    monaco: "cpp",
    wandbox: { compiler: "gcc-13.2.0" },
    piston: { language: "c++", version: "10.2.0", filename: "main.cpp" },
    starter: `#include <iostream>\nint main(){ std::cout << "Hello from C++" << std::endl; return 0; }\n`,
  },
  csharp: {
    label: "C#",
    monaco: "csharp",
    wandbox: { compiler: "mono-6.12.0.199" },
    piston: { language: "csharp", version: "6.12.0", filename: "Main.cs" },
    starter: `using System;\nclass Program { static void Main(){ Console.WriteLine("Hello from C#"); } }\n`,
  },
  php: {
    label: "PHP",
    monaco: "php",
    wandbox: { compiler: "php-8.3.12" },
    piston: { language: "php", version: "8.2.3", filename: "main.php" },
    starter: `<?php\necho "Hello from PHP\\n";\n`,
  },
  go: {
    label: "Go",
    monaco: "go",
    wandbox: { compiler: "go-1.23.2" },
    piston: { language: "go", version: "1.16.2", filename: "main.go" },
    starter: `package main\nimport "fmt"\nfunc main(){ fmt.Println("Hello from Go") }\n`,
  },
  rust: {
    label: "Rust",
    monaco: "rust",
    wandbox: { compiler: "rust-1.82.0" },
    piston: { language: "rust", version: "1.68.2", filename: "main.rs" },
    starter: `fn main(){ println!("Hello from Rust"); }\n`,
  },
  ruby: {
    label: "Ruby",
    monaco: "ruby",
    wandbox: { compiler: "ruby-3.4.9" },
    starter: `puts "Hello from Ruby"\n`,
  },
  bash: {
    label: "Bash",
    monaco: "shell",
    wandbox: { compiler: "bash" },
    starter: `echo "Hello from Bash"\n`,
  },
};

export const PROVIDERS: Record<ProviderKey, { label: string; description: string; dailyFreeLimit: number }> = {
  wandbox: {
    label: "Wandbox",
    description: "Free public Wandbox compiler service · supports every language listed",
    dailyFreeLimit: 300,
  },
  piston: {
    label: "Piston (legacy)",
    description: "Public Piston API is whitelist-only since Feb 2026 — usually returns 403. Kept for completeness.",
    dailyFreeLimit: 500,
  },
};

export interface RunResult {
  stdout: string;
  stderr: string;
  output: string;
  code: number | null;
  signal: string | null;
  provider: ProviderKey;
}

class ProviderError extends Error {
  constructor(public provider: ProviderKey, public status: number | null, message: string) {
    super(message);
  }
  get isTransient() {
    return (
      this.status === 429 ||
      this.status === 403 ||
      (this.status !== null && this.status >= 500)
    );
  }
}

async function runWandbox(lang: LangKey, source: string, stdin: string): Promise<RunResult> {
  const wb = LANGUAGES[lang].wandbox;
  const res = await fetch("https://wandbox.org/api/compile.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: source, compiler: wb.compiler, stdin }),
  });
  if (!res.ok) throw new ProviderError("wandbox", res.status, `Wandbox ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const stdout: string = data.program_output ?? "";
  const stderr: string = data.program_error ?? "";
  const compilerErr: string = data.compiler_error ?? "";
  const combinedErr = [compilerErr, stderr].filter(Boolean).join("\n");
  const exit = typeof data.status === "string" ? Number.parseInt(data.status, 10) : null;
  return {
    stdout,
    stderr: combinedErr,
    output: combinedErr ? `${stdout}${stdout && combinedErr ? "\n" : ""}${combinedErr}` : stdout,
    code: Number.isFinite(exit as number) ? (exit as number) : null,
    signal: data.signal || null,
    provider: "wandbox",
  };
}

async function runPiston(lang: LangKey, source: string, stdin: string): Promise<RunResult> {
  const spec = LANGUAGES[lang].piston;
  if (!spec) throw new ProviderError("piston", null, `Piston does not have a config for ${LANGUAGES[lang].label}. Switch to Wandbox.`);
  const res = await fetch("https://emkc.org/api/v2/piston/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: spec.language,
      version: spec.version,
      stdin,
      files: [{ name: spec.filename, content: source }],
    }),
  });
  const text = await res.text();
  let data: any = {};
  try { data = JSON.parse(text); } catch { /* non-json */ }
  if (!res.ok) {
    const detail = data?.message || text.slice(0, 200);
    throw new ProviderError("piston", res.status, `Piston ${res.status}: ${detail}`);
  }
  // Even on 200 the whitelist gate may respond with `{message: "..."}` and no run block.
  if (data?.message && !data?.run) {
    throw new ProviderError("piston", 403, `Piston: ${data.message}`);
  }
  const run = data.run ?? {};
  const compile = data.compile ?? {};
  const stdout = (compile.stdout ?? "") + (run.stdout ?? "");
  const stderr = (compile.stderr ?? "") + (run.stderr ?? "");
  return {
    stdout,
    stderr,
    output: stderr ? `${stdout}${stdout && stderr ? "\n" : ""}${stderr}` : stdout,
    code: run.code ?? compile.code ?? null,
    signal: run.signal ?? null,
    provider: "piston",
  };
}

const USAGE_KEY = "playground:usage:v1";

interface UsageState {
  date: string;
  counts: Record<ProviderKey, number>;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function readUsage(): UsageState {
  if (typeof window === "undefined") return { date: todayKey(), counts: { wandbox: 0, piston: 0 } };
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as UsageState;
      if (parsed.date === todayKey()) {
        return { date: parsed.date, counts: { wandbox: 0, piston: 0, ...parsed.counts } };
      }
    }
  } catch {
    /* ignore */
  }
  return { date: todayKey(), counts: { wandbox: 0, piston: 0 } };
}

export function bumpUsage(provider: ProviderKey): UsageState {
  const state = readUsage();
  state.counts[provider] = (state.counts[provider] ?? 0) + 1;
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("playground-usage"));
  return state;
}

async function runWithProvider(provider: ProviderKey, lang: LangKey, source: string, stdin: string) {
  const result = provider === "piston" ? await runPiston(lang, source, stdin) : await runWandbox(lang, source, stdin);
  bumpUsage(provider);
  return result;
}

export interface RunOptions {
  fallback?: boolean;
  onFallback?: (info: { from: ProviderKey; to: ProviderKey; reason: string }) => void;
}

function friendlyError(err: unknown, provider: ProviderKey): string {
  if (err instanceof ProviderError) {
    if (err.status === 429) return `${PROVIDERS[provider].label} is rate-limited right now (HTTP 429). Try again in a moment or switch providers.`;
    if (err.status === 403) return `${PROVIDERS[provider].label} rejected the request (HTTP 403). ${err.message}`;
    if (err.status && err.status >= 500) return `${PROVIDERS[provider].label} is temporarily unavailable (HTTP ${err.status}).`;
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

export async function runCode(
  lang: LangKey,
  source: string,
  stdin = "",
  provider: ProviderKey = "wandbox",
  options: RunOptions = {},
): Promise<RunResult> {
  try {
    return await runWithProvider(provider, lang, source, stdin);
  } catch (err) {
    const transient = err instanceof ProviderError && err.isTransient;
    const alt: ProviderKey = provider === "wandbox" ? "piston" : "wandbox";
    const altSupports = alt === "wandbox" ? true : Boolean(LANGUAGES[lang].piston);
    if (options.fallback && transient && altSupports) {
      const reason = friendlyError(err, provider);
      options.onFallback?.({ from: provider, to: alt, reason });
      try {
        return await runWithProvider(alt, lang, source, stdin);
      } catch (err2) {
        throw new Error(`Both providers failed.\n${reason}\n${friendlyError(err2, alt)}`);
      }
    }
    throw new Error(friendlyError(err, provider));
  }
}

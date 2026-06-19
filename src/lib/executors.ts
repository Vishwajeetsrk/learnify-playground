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
  | "bash"
  | "kotlin"
  | "swift"
  | "dart"
  | "scala"
  | "objc"
  | "sql";

export type ProviderKey = "judge0" | "piston" | "wandbox";

interface LangSpec {
  label: string;
  monaco: string;
  wandbox?: { compiler: string };
  piston?: { language: string; version: string; filename: string };
  judge0?: { id: number };
  starter: string;
  /** false = no live executor; runCode throws a friendly snippet-mode message. */
  runnable?: boolean;
}

export const LANGUAGES: Record<LangKey, LangSpec> = {
  python: {
    label: "Python",
    monaco: "python",
    judge0: { id: 71 },
    wandbox: { compiler: "cpython-3.14.0" },
    piston: { language: "python", version: "3.10.0", filename: "main.py" },
    starter: `print("Hello from Python")\n`,
  },
  javascript: {
    label: "JavaScript",
    monaco: "javascript",
    judge0: { id: 63 },
    wandbox: { compiler: "nodejs-20.17.0" },
    piston: { language: "javascript", version: "18.15.0", filename: "main.js" },
    starter: `console.log("Hello from JavaScript");\n`,
  },
  typescript: {
    label: "TypeScript",
    monaco: "typescript",
    judge0: { id: 74 },
    wandbox: { compiler: "typescript-5.6.2" },
    piston: { language: "typescript", version: "5.0.3", filename: "main.ts" },
    starter: `const msg: string = "Hello from TypeScript";\nconsole.log(msg);\n`,
  },
  java: {
    label: "Java",
    monaco: "java",
    judge0: { id: 62 },
    wandbox: { compiler: "openjdk-jdk-22+36" },
    piston: { language: "java", version: "15.0.2", filename: "Main.java" },
    starter: `class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello from Java");\n  }\n}\n`,
  },
  c: {
    label: "C",
    monaco: "c",
    judge0: { id: 50 },
    wandbox: { compiler: "gcc-13.2.0-c" },
    piston: { language: "c", version: "10.2.0", filename: "main.c" },
    starter: `#include <stdio.h>\nint main(){ printf("Hello from C\\n"); return 0; }\n`,
  },
  cpp: {
    label: "C++",
    monaco: "cpp",
    judge0: { id: 54 },
    wandbox: { compiler: "gcc-13.2.0" },
    piston: { language: "c++", version: "10.2.0", filename: "main.cpp" },
    starter: `#include <iostream>\nint main(){ std::cout << "Hello from C++" << std::endl; return 0; }\n`,
  },
  csharp: {
    label: "C#",
    monaco: "csharp",
    judge0: { id: 51 },
    wandbox: { compiler: "mono-6.12.0.199" },
    piston: { language: "csharp", version: "6.12.0", filename: "Main.cs" },
    starter: `using System;\nclass Program { static void Main(){ Console.WriteLine("Hello from C#"); } }\n`,
  },
  php: {
    label: "PHP",
    monaco: "php",
    judge0: { id: 68 },
    wandbox: { compiler: "php-8.3.12" },
    piston: { language: "php", version: "8.2.3", filename: "main.php" },
    starter: `<?php\necho "Hello from PHP\\n";\n`,
  },
  go: {
    label: "Go",
    monaco: "go",
    judge0: { id: 60 },
    wandbox: { compiler: "go-1.23.2" },
    piston: { language: "go", version: "1.16.2", filename: "main.go" },
    starter: `package main\nimport "fmt"\nfunc main(){ fmt.Println("Hello from Go") }\n`,
  },
  rust: {
    label: "Rust",
    monaco: "rust",
    judge0: { id: 73 },
    wandbox: { compiler: "rust-1.82.0" },
    piston: { language: "rust", version: "1.68.2", filename: "main.rs" },
    starter: `fn main(){ println!("Hello from Rust"); }\n`,
  },
  ruby: {
    label: "Ruby",
    monaco: "ruby",
    judge0: { id: 72 },
    wandbox: { compiler: "ruby-3.4.9" },
    starter: `puts "Hello from Ruby"\n`,
  },
  bash: {
    label: "Bash",
    monaco: "shell",
    judge0: { id: 46 },
    wandbox: { compiler: "bash" },
    starter: `echo "Hello from Bash"\n`,
  },
  kotlin: {
    label: "Kotlin",
    monaco: "kotlin",
    judge0: { id: 78 },
    piston: { language: "kotlin", version: "1.8.20", filename: "main.kt" },
    starter: `fun main() {\n  println("Hello from Kotlin")\n}\n`,
  },
  swift: {
    label: "Swift",
    monaco: "swift",
    wandbox: { compiler: "swift-5.10.1" },
    piston: { language: "swift", version: "5.3.3", filename: "main.swift" },
    starter: `let name = "Swift"\nprint("Hello from \\(name)")\n`,
  },
  scala: {
    label: "Scala",
    monaco: "scala",
    wandbox: { compiler: "scala-3.5.0" },
    piston: { language: "scala", version: "3.2.2", filename: "Main.scala" },
    starter: `@main def hello() = println("Hello from Scala")\n`,
  },
  dart: {
    label: "Dart",
    monaco: "dart",
    piston: { language: "dart", version: "2.19.6", filename: "main.dart" },
    starter: `void main() {\n  print('Hello from Dart');\n}\n`,
  },
  objc: {
    label: "Objective-C",
    monaco: "objective-c",
    runnable: false,
    starter: `#import <Foundation/Foundation.h>\nint main(){ @autoreleasepool { NSLog(@"Hello from Objective-C"); } return 0; }\n`,
  },
  sql: {
    label: "SQL",
    monaco: "sql",
    wandbox: { compiler: "sqlite-3.46.1" },
    piston: { language: "sqlite3", version: "3.36.0", filename: "main.sql" },
    starter: `SELECT 'Hello from SQL' AS greeting;\n`,
  },
};

export const PROVIDERS: Record<ProviderKey, { label: string; description: string; dailyFreeLimit: number }> = {
  judge0: {
    label: "Judge0 CE",
    description: "Public Judge0 CE runner · reports runtime + memory · public ce.judge0.com by default, or point at a self-hosted instance via Settings.",
    dailyFreeLimit: 50,
  },
  piston: {
    label: "Piston",
    description: "Engineer-Man Piston runner · public emkc.org by default, or point at a self-hosted instance via Settings.",
    dailyFreeLimit: 500,
  },
  wandbox: {
    label: "Wandbox",
    description: "Free public Wandbox compiler service · supports a wide range of compilers.",
    dailyFreeLimit: 300,
  },
};

const PISTON_URL_KEY = "playground:piston-url";
const DEFAULT_PISTON_URL = "https://emkc.org/api/v2/piston";
const JUDGE0_URL_KEY = "playground:judge0-url";
const DEFAULT_JUDGE0_URL = "https://ce.judge0.com";

export function getPistonBaseUrl(): string {
  if (typeof window === "undefined") return DEFAULT_PISTON_URL;
  try {
    return localStorage.getItem(PISTON_URL_KEY)?.trim() || DEFAULT_PISTON_URL;
  } catch {
    return DEFAULT_PISTON_URL;
  }
}

export function setPistonBaseUrl(url: string) {
  if (typeof window === "undefined") return;
  try {
    const clean = url.trim().replace(/\/+$/, "");
    if (clean && clean !== DEFAULT_PISTON_URL) {
      localStorage.setItem(PISTON_URL_KEY, clean);
    } else {
      localStorage.removeItem(PISTON_URL_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function getJudge0BaseUrl(): string {
  if (typeof window === "undefined") return DEFAULT_JUDGE0_URL;
  try {
    return localStorage.getItem(JUDGE0_URL_KEY)?.trim() || DEFAULT_JUDGE0_URL;
  } catch {
    return DEFAULT_JUDGE0_URL;
  }
}

export function setJudge0BaseUrl(url: string) {
  if (typeof window === "undefined") return;
  try {
    const clean = url.trim().replace(/\/+$/, "");
    if (clean && clean !== DEFAULT_JUDGE0_URL) {
      localStorage.setItem(JUDGE0_URL_KEY, clean);
    } else {
      localStorage.removeItem(JUDGE0_URL_KEY);
    }
  } catch {
    /* ignore */
  }
}


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
      this.status === 401 ||
      this.status === 403 ||
      this.status === 429 ||
      (this.status !== null && this.status >= 500)
    );
  }
}

async function runWandbox(lang: LangKey, source: string, stdin: string): Promise<RunResult> {
  const wb = LANGUAGES[lang].wandbox;
  if (!wb) throw new ProviderError("wandbox", null, `${LANGUAGES[lang].label} has no Wandbox compiler configured. Use the AI assistant or run locally.`);
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
  const base = getPistonBaseUrl();
  const res = await fetch(`${base}/execute`, {
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
        return { date: parsed.date, counts: { wandbox: parsed.counts?.wandbox ?? 0, piston: parsed.counts?.piston ?? 0 } };
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
    if (err.status === 401 || err.status === 403) {
      return `${PROVIDERS[provider].label} rejected the request (HTTP ${err.status}).${provider === "piston" ? " If you're using the public emkc.org endpoint, try a self-hosted Piston URL in Settings." : ""}`;
    }
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
  if (LANGUAGES[lang].runnable === false) {
    throw new Error(`${LANGUAGES[lang].label} runs in snippet mode — no free online executor. Use the AI assistant to explain, convert, or generate tests, or copy the code to your local toolchain.`);
  }
  // If the selected provider doesn't support this language but the other one
  // does, transparently route to the one that does (Kotlin/Dart → Piston,
  // Ruby/Bash → Wandbox, etc.).
  const spec = LANGUAGES[lang];
  if (provider === "wandbox" && !spec.wandbox && spec.piston) provider = "piston";
  else if (provider === "piston" && !spec.piston && spec.wandbox) provider = "wandbox";
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

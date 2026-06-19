// Free code execution providers. Both are key-less public APIs.
// - piston: https://github.com/engineer-man/piston (emkc.org)
// - wandbox: https://wandbox.org (limited language coverage)

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
  | "kotlin";

export type ProviderKey = "piston" | "wandbox";

interface LangSpec {
  label: string;
  monaco: string;
  piston: { language: string; version: string; filename: string };
  wandbox?: { compiler: string };
  starter: string;
}

export const LANGUAGES: Record<LangKey, LangSpec> = {
  python: {
    label: "Python",
    monaco: "python",
    piston: { language: "python", version: "3.10.0", filename: "main.py" },
    wandbox: { compiler: "cpython-3.10.2" },
    starter: `print("Hello from Python")\n`,
  },
  javascript: {
    label: "JavaScript",
    monaco: "javascript",
    piston: { language: "javascript", version: "18.15.0", filename: "main.js" },
    wandbox: { compiler: "nodejs-16.14.0" },
    starter: `console.log("Hello from JavaScript");\n`,
  },
  typescript: {
    label: "TypeScript",
    monaco: "typescript",
    piston: { language: "typescript", version: "5.0.3", filename: "main.ts" },
    starter: `const msg: string = "Hello from TypeScript";\nconsole.log(msg);\n`,
  },
  java: {
    label: "Java",
    monaco: "java",
    piston: { language: "java", version: "15.0.2", filename: "Main.java" },
    wandbox: { compiler: "openjdk-jdk-15.0.3+3" },
    starter: `public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello from Java");\n  }\n}\n`,
  },
  c: {
    label: "C",
    monaco: "c",
    piston: { language: "c", version: "10.2.0", filename: "main.c" },
    wandbox: { compiler: "gcc-head-c" },
    starter: `#include <stdio.h>\nint main(){ printf("Hello from C\\n"); return 0; }\n`,
  },
  cpp: {
    label: "C++",
    monaco: "cpp",
    piston: { language: "c++", version: "10.2.0", filename: "main.cpp" },
    wandbox: { compiler: "gcc-head" },
    starter: `#include <iostream>\nint main(){ std::cout << "Hello from C++" << std::endl; return 0; }\n`,
  },
  csharp: {
    label: "C#",
    monaco: "csharp",
    piston: { language: "csharp", version: "6.12.0", filename: "Main.cs" },
    starter: `using System;\nclass Program { static void Main(){ Console.WriteLine("Hello from C#"); } }\n`,
  },
  php: {
    label: "PHP",
    monaco: "php",
    piston: { language: "php", version: "8.2.3", filename: "main.php" },
    wandbox: { compiler: "php-head" },
    starter: `<?php\necho "Hello from PHP\\n";\n`,
  },
  go: {
    label: "Go",
    monaco: "go",
    piston: { language: "go", version: "1.16.2", filename: "main.go" },
    wandbox: { compiler: "go-head" },
    starter: `package main\nimport "fmt"\nfunc main(){ fmt.Println("Hello from Go") }\n`,
  },
  rust: {
    label: "Rust",
    monaco: "rust",
    piston: { language: "rust", version: "1.68.2", filename: "main.rs" },
    wandbox: { compiler: "rust-head" },
    starter: `fn main(){ println!("Hello from Rust"); }\n`,
  },
  kotlin: {
    label: "Kotlin",
    monaco: "kotlin",
    piston: { language: "kotlin", version: "1.8.20", filename: "main.kt" },
    starter: `fun main(){ println("Hello from Kotlin") }\n`,
  },
};

export const PROVIDERS: Record<ProviderKey, { label: string; description: string; dailyFreeLimit: number }> = {
  piston: {
    label: "Piston (emkc.org)",
    description: "Free public Piston API · ~200 req/min shared limit",
    dailyFreeLimit: 500,
  },
  wandbox: {
    label: "Wandbox",
    description: "Free public Wandbox compiler service · best for compiled languages",
    dailyFreeLimit: 300,
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
    return this.status === 429 || (this.status !== null && this.status >= 500);
  }
}

async function runPiston(lang: LangKey, source: string, stdin: string): Promise<RunResult> {
  const spec = LANGUAGES[lang].piston;
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
  if (!res.ok) throw new ProviderError("piston", res.status, `Piston ${res.status}: ${await res.text()}`);
  const data = await res.json();
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


async function runWandbox(lang: LangKey, source: string, stdin: string): Promise<RunResult> {
  const wb = LANGUAGES[lang].wandbox;
  if (!wb) throw new Error(`Wandbox does not support ${LANGUAGES[lang].label}. Switch to Piston.`);
  const res = await fetch("https://wandbox.org/api/compile.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: source, compiler: wb.compiler, stdin }),
  });
  if (!res.ok) throw new Error(`Wandbox ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const stdout: string = data.program_output ?? data.compiler_output ?? "";
  const stderr: string = data.program_error ?? data.compiler_error ?? "";
  return {
    stdout,
    stderr,
    output: stderr ? `${stdout}${stdout && stderr ? "\n" : ""}${stderr}` : stdout,
    code: typeof data.status === "string" ? Number.parseInt(data.status, 10) || 0 : null,
    signal: data.signal ?? null,
    provider: "wandbox",
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
  if (typeof window === "undefined") return { date: todayKey(), counts: { piston: 0, wandbox: 0 } };
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as UsageState;
      if (parsed.date === todayKey()) return parsed;
    }
  } catch {
    /* ignore */
  }
  return { date: todayKey(), counts: { piston: 0, wandbox: 0 } };
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

export async function runCode(
  lang: LangKey,
  source: string,
  stdin = "",
  provider: ProviderKey = "piston",
): Promise<RunResult> {
  const result = provider === "wandbox" ? await runWandbox(lang, source, stdin) : await runPiston(lang, source, stdin);
  bumpUsage(provider);
  return result;
}

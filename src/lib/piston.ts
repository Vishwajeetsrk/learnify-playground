// Piston public API: https://github.com/engineer-man/piston
const PISTON_URL = "https://emkc.org/api/v2/piston";

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

interface LangSpec {
  label: string;
  monaco: string;
  piston: string;
  version: string;
  filename: string;
  starter: string;
}

export const LANGUAGES: Record<LangKey, LangSpec> = {
  python: {
    label: "Python",
    monaco: "python",
    piston: "python",
    version: "3.10.0",
    filename: "main.py",
    starter: `print("Hello from Python")\n`,
  },
  javascript: {
    label: "JavaScript",
    monaco: "javascript",
    piston: "javascript",
    version: "18.15.0",
    filename: "main.js",
    starter: `console.log("Hello from JavaScript");\n`,
  },
  typescript: {
    label: "TypeScript",
    monaco: "typescript",
    piston: "typescript",
    version: "5.0.3",
    filename: "main.ts",
    starter: `const msg: string = "Hello from TypeScript";\nconsole.log(msg);\n`,
  },
  java: {
    label: "Java",
    monaco: "java",
    piston: "java",
    version: "15.0.2",
    filename: "Main.java",
    starter: `public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello from Java");\n  }\n}\n`,
  },
  c: {
    label: "C",
    monaco: "c",
    piston: "c",
    version: "10.2.0",
    filename: "main.c",
    starter: `#include <stdio.h>\nint main(){ printf("Hello from C\\n"); return 0; }\n`,
  },
  cpp: {
    label: "C++",
    monaco: "cpp",
    piston: "c++",
    version: "10.2.0",
    filename: "main.cpp",
    starter: `#include <iostream>\nint main(){ std::cout << "Hello from C++" << std::endl; return 0; }\n`,
  },
  csharp: {
    label: "C#",
    monaco: "csharp",
    piston: "csharp",
    version: "6.12.0",
    filename: "Main.cs",
    starter: `using System;\nclass Program { static void Main(){ Console.WriteLine("Hello from C#"); } }\n`,
  },
  php: {
    label: "PHP",
    monaco: "php",
    piston: "php",
    version: "8.2.3",
    filename: "main.php",
    starter: `<?php\necho "Hello from PHP\\n";\n`,
  },
  go: {
    label: "Go",
    monaco: "go",
    piston: "go",
    version: "1.16.2",
    filename: "main.go",
    starter: `package main\nimport "fmt"\nfunc main(){ fmt.Println("Hello from Go") }\n`,
  },
  rust: {
    label: "Rust",
    monaco: "rust",
    piston: "rust",
    version: "1.68.2",
    filename: "main.rs",
    starter: `fn main(){ println!("Hello from Rust"); }\n`,
  },
  kotlin: {
    label: "Kotlin",
    monaco: "kotlin",
    piston: "kotlin",
    version: "1.8.20",
    filename: "main.kt",
    starter: `fun main(){ println("Hello from Kotlin") }\n`,
  },
};

export interface PistonResult {
  stdout: string;
  stderr: string;
  output: string;
  code: number | null;
  signal: string | null;
}

export async function runCode(lang: LangKey, source: string, stdin = ""): Promise<PistonResult> {
  const spec = LANGUAGES[lang];
  const res = await fetch(`${PISTON_URL}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: spec.piston,
      version: spec.version,
      stdin,
      files: [{ name: spec.filename, content: source }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Piston ${res.status}: ${text}`);
  }
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
  };
}

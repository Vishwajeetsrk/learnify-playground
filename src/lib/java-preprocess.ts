// Wandbox/Piston compile Java as `prog.java`. The JLS requires a public top-level
// type to live in a file named after it, so any `public class Foo` blows up with
// "class Foo is public, should be declared in a file named Foo.java".
//
// Strategy:
// 1. Find the entry class — the one declaring `public static void main`.
// 2. Strip the `public` modifier from every OTHER top-level type.
// 3. Strip `public` from the entry class too (filename is prog.java, not Foo.java).
// 4. If no main is found, wrap the snippet in a synthetic `Main` class with a
//    main() that calls a top-level `run()` if present, otherwise prints a hint.

export interface PreprocessResult {
  code: string;
  mainClass: string | null;
  changed: boolean;
  wrapped: boolean;
}

const TOP_LEVEL_TYPE_RE =
  /^(?<indent>[ \t]*)(?<mods>(?:public|final|abstract|sealed|non-sealed|static|strictfp|\s)+)?(?<kind>class|interface|enum|record)\s+(?<name>[A-Za-z_$][\w$]*)/gm;

const MAIN_RE =
  /\b(public\s+static|static\s+public)\s+void\s+main\s*\(\s*(final\s+)?String\s*(\[\s*\]|\.\.\.)\s*\w+\s*\)/;

export function findMainClass(code: string): string | null {
  // Walk top-level types and pick the one whose body contains a main method.
  let m: RegExpExecArray | null;
  TOP_LEVEL_TYPE_RE.lastIndex = 0;
  while ((m = TOP_LEVEL_TYPE_RE.exec(code))) {
    const start = code.indexOf("{", m.index);
    if (start < 0) continue;
    const body = sliceBalanced(code, start);
    if (body && MAIN_RE.test(body)) return m.groups!.name;
  }
  return null;
}

function sliceBalanced(code: string, openIdx: number): string | null {
  let depth = 0;
  for (let i = openIdx; i < code.length; i++) {
    const c = code[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return code.slice(openIdx, i + 1);
    }
  }
  return null;
}

export function preprocessJava(input: string): PreprocessResult {
  const original = input;
  const mainClass = findMainClass(input);

  if (!mainClass) {
    // No main found — wrap in a Main shell so users can paste expression-y code.
    const wrapped = `class Main {\n  public static void main(String[] args) throws Exception {\n${indent(input)}\n  }\n}\n`;
    return { code: wrapped, mainClass: "Main", changed: true, wrapped: true };
  }

  // Strip `public` from every top-level type declaration.
  const stripped = input.replace(
    /^([ \t]*)((?:(?:final|abstract|sealed|non-sealed|static|strictfp)\s+)*)public(\s+(?:(?:final|abstract|sealed|non-sealed|static|strictfp)\s+)*(?:class|interface|enum|record)\s+)/gm,
    "$1$2$3",
  );

  return {
    code: stripped,
    mainClass,
    changed: stripped !== original,
    wrapped: false,
  };
}

function indent(s: string): string {
  return s
    .split("\n")
    .map((l) => (l.length ? "    " + l : l))
    .join("\n");
}

// Map a Wandbox/Piston compiler error to a 1-based line in the user's ORIGINAL
// source. The compiler reports lines in the preprocessed file, which (for the
// non-wrapped case) match the user's source line-for-line because we only
// substitute spaces for `public`. For the wrapped case we shift by 2.
export interface CompileError {
  line: number; // 1-based, in user's original source (best-effort)
  message: string;
  raw: string;
}

const ERR_LINE_RE = /^prog\.java:(\d+):\s*(?:error|warning):\s*(.*)$/i;

export function parseJavaErrors(stderr: string, wrapped: boolean): CompileError[] {
  const out: CompileError[] = [];
  for (const raw of stderr.split("\n")) {
    const m = ERR_LINE_RE.exec(raw.trim());
    if (!m) continue;
    const reported = Number(m[1]);
    const line = wrapped ? Math.max(1, reported - 2) : reported;
    out.push({ line, message: m[2], raw });
  }
  return out;
}

import { describe, it, expect } from "bun:test";
import {
  findMainClass,
  preprocessJava,
  parseJavaErrors,
} from "./java-preprocess";

describe("findMainClass", () => {
  it("finds a single public class with main", () => {
    const src = `public class MainActivity {\n  public static void main(String[] a) {}\n}`;
    expect(findMainClass(src)).toBe("MainActivity");
  });

  it("returns the class containing main when there are multiple", () => {
    const src = `class Helper { void x() {} }\npublic class App {\n  public static void main(String[] args) {}\n}`;
    expect(findMainClass(src)).toBe("App");
  });

  it("handles varargs main", () => {
    const src = `class M { public static void main(String... args) {} }`;
    expect(findMainClass(src)).toBe("M");
  });

  it("returns null when no main exists", () => {
    const src = `class A { int x; }`;
    expect(findMainClass(src)).toBeNull();
  });
});

describe("preprocessJava", () => {
  it("strips public from top-level class with main", () => {
    const src = `public class MainActivity {\n  public static void main(String[] a) {}\n}`;
    const r = preprocessJava(src);
    expect(r.wrapped).toBe(false);
    expect(r.mainClass).toBe("MainActivity");
    expect(r.code).not.toMatch(/^public\s+class\s+MainActivity/m);
    expect(r.code).toMatch(/class\s+MainActivity/);
    // Inner public static method must survive.
    expect(r.code).toMatch(/public static void main/);
  });

  it("strips public from multiple top-level classes", () => {
    const src = `public class A { public static void main(String[] a){} }\npublic class B {}`;
    const r = preprocessJava(src);
    expect(r.code).not.toMatch(/^public class A/m);
    expect(r.code).not.toMatch(/^public class B/m);
    expect(r.mainClass).toBe("A");
  });

  it("preserves modifier order: final public class -> final  class", () => {
    const src = `final public class App { public static void main(String[] a){} }`;
    const r = preprocessJava(src);
    expect(r.code).not.toMatch(/public class/);
    expect(r.code).toMatch(/final\s+class\s+App/);
  });

  it("wraps snippet code without main in a Main class", () => {
    const src = `System.out.println("hi");`;
    const r = preprocessJava(src);
    expect(r.wrapped).toBe(true);
    expect(r.mainClass).toBe("Main");
    expect(r.code).toMatch(/class Main \{/);
    expect(r.code).toMatch(/public static void main/);
    expect(r.code).toMatch(/System\.out\.println\("hi"\);/);
  });

  it("is a no-op when no public top-level modifier exists", () => {
    const src = `class M { public static void main(String[] a){} }`;
    const r = preprocessJava(src);
    expect(r.changed).toBe(false);
    expect(r.code).toBe(src);
  });
});

describe("parseJavaErrors", () => {
  it("parses prog.java:LINE: error: lines", () => {
    const err = `prog.java:3: error: class MainActivity is public, should be declared in a file named MainActivity.java\npublic class MainActivity {\n       ^\n1 error`;
    const errs = parseJavaErrors(err, false);
    expect(errs.length).toBe(1);
    expect(errs[0].line).toBe(3);
    expect(errs[0].message).toMatch(/should be declared/);
  });

  it("shifts line numbers by 2 when wrapped", () => {
    const err = `prog.java:5: error: ';' expected`;
    const errs = parseJavaErrors(err, true);
    expect(errs[0].line).toBe(3);
  });

  it("ignores noise lines", () => {
    expect(parseJavaErrors("1 error\n", false)).toEqual([]);
  });
});

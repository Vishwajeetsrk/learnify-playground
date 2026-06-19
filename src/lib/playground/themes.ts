// Theme system for the mobile IDE. App themes drive page chrome; editor themes
// map to Monaco's built-in / dynamically defined themes.
import { useEffect, useState } from "react";
import type { editor } from "monaco-editor";

export const APP_THEMES = {
  dark:   { label: "Dark",   bg: "#0b1020", panel: "#11172e", border: "#1d2547", text: "#e8ecff", subtle: "#8b95c5" },
  amoled: { label: "AMOLED", bg: "#000000", panel: "#0a0a0a", border: "#1a1a1a", text: "#f0f0f0", subtle: "#888888" },
  light:  { label: "Light",  bg: "#f5f7fb", panel: "#ffffff", border: "#e3e8f1", text: "#0f1421", subtle: "#5a6485" },
} as const;
export type AppThemeKey = keyof typeof APP_THEMES;

export const EDITOR_THEMES = {
  "vs-dark":     { label: "VS Code Dark",  monaco: "vs-dark" },
  "dracula":     { label: "Dracula",       monaco: "playground-dracula" },
  "monokai":     { label: "Monokai",       monaco: "playground-monokai" },
  "github-dark": { label: "GitHub Dark",   monaco: "playground-github-dark" },
  "light":       { label: "Light",         monaco: "vs" },
} as const;
export type EditorThemeKey = keyof typeof EDITOR_THEMES;

// Custom Monaco themes registered once when monaco loads.
export function registerEditorThemes(monaco: typeof import("monaco-editor")) {
  const dracula: editor.IStandaloneThemeData = {
    base: "vs-dark", inherit: true,
    rules: [
      { token: "comment", foreground: "6272a4", fontStyle: "italic" },
      { token: "keyword", foreground: "ff79c6" },
      { token: "string",  foreground: "f1fa8c" },
      { token: "number",  foreground: "bd93f9" },
      { token: "type",    foreground: "8be9fd" },
    ],
    colors: { "editor.background": "#282a36", "editor.foreground": "#f8f8f2", "editorCursor.foreground": "#f8f8f0", "editor.lineHighlightBackground": "#44475a55" },
  };
  const monokai: editor.IStandaloneThemeData = {
    base: "vs-dark", inherit: true,
    rules: [
      { token: "comment", foreground: "75715e", fontStyle: "italic" },
      { token: "keyword", foreground: "f92672" },
      { token: "string",  foreground: "e6db74" },
      { token: "number",  foreground: "ae81ff" },
      { token: "type",    foreground: "66d9ef" },
    ],
    colors: { "editor.background": "#272822", "editor.foreground": "#f8f8f2", "editor.lineHighlightBackground": "#3e3d3255" },
  };
  const githubDark: editor.IStandaloneThemeData = {
    base: "vs-dark", inherit: true,
    rules: [
      { token: "comment", foreground: "8b949e", fontStyle: "italic" },
      { token: "keyword", foreground: "ff7b72" },
      { token: "string",  foreground: "a5d6ff" },
      { token: "number",  foreground: "79c0ff" },
      { token: "type",    foreground: "ffa657" },
    ],
    colors: { "editor.background": "#0d1117", "editor.foreground": "#e6edf3", "editor.lineHighlightBackground": "#161b2255" },
  };
  monaco.editor.defineTheme("playground-dracula", dracula);
  monaco.editor.defineTheme("playground-monokai", monokai);
  monaco.editor.defineTheme("playground-github-dark", githubDark);
}

const APP_KEY = "playground-ide:appTheme";
const EDITOR_KEY = "playground-ide:editorTheme";

function read<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  if (typeof window === "undefined") return fallback;
  const v = localStorage.getItem(key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function useAppTheme() {
  const [theme, setTheme] = useState<AppThemeKey>("dark");
  useEffect(() => { setTheme(read(APP_KEY, "dark", Object.keys(APP_THEMES) as AppThemeKey[])); }, []);
  useEffect(() => { try { localStorage.setItem(APP_KEY, theme); } catch {} }, [theme]);
  return [theme, setTheme] as const;
}

export function useEditorTheme() {
  const [theme, setTheme] = useState<EditorThemeKey>("vs-dark");
  useEffect(() => { setTheme(read(EDITOR_KEY, "vs-dark", Object.keys(EDITOR_THEMES) as EditorThemeKey[])); }, []);
  useEffect(() => { try { localStorage.setItem(EDITOR_KEY, theme); } catch {} }, [theme]);
  return [theme, setTheme] as const;
}

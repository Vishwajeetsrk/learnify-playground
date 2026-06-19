// Centralized icon set for the playground.
// - Template tiles use lucide icons (consistent stroke-based set).
// - Languages and file extensions use real brand SVG logos (react-icons/si).
import type { ComponentType, SVGProps } from "react";
import {
  Calculator, ListChecks, Lock, MessageSquare, NotebookPen, Wallet,
  LayoutPanelLeft, Image as ImageIcon, Smartphone, Sparkles, Globe,
  FileCode, Hash, FileText, FileJson, FileType, Terminal as TerminalIcon,
  Database, Braces, Code2,
} from "lucide-react";
import {
  SiPython, SiJavascript, SiTypescript, SiOpenjdk, SiCplusplus, SiC,
  SiGo, SiRust, SiRuby, SiPhp, SiNodedotjs, SiGnubash, SiHtml5, SiCss,
  SiReact, SiSharp, SiKotlin, SiSwift, SiDart, SiScala, SiApple,
  SiSqlite, SiMysql, SiPostgresql, SiMongodb, SiMariadb,
  SiExpress, SiFlask, SiFastapi, SiSpring, SiDotnet, SiNextdotjs, SiFlutter, SiAndroid,
} from "react-icons/si";
import type { LangKey } from "@/lib/executors";

type IconCmp = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

interface IconSpec { Cmp: IconCmp; color?: string }

// ---------------------------------------------------------------------------
// Template tile icons

const TEMPLATE_ICONS: Record<string, IconSpec> = {
  "blank-web":     { Cmp: Globe,            color: "#7eb2ff" },
  "blank-code":    { Cmp: Code2,            color: "#9aa3cf" },
  calculator:      { Cmp: Calculator,       color: "#ff7e9a" },
  todo:            { Cmp: ListChecks,       color: "#5fd38a" },
  login:           { Cmp: Lock,             color: "#7eb2ff" },
  chat:            { Cmp: MessageSquare,    color: "#7e5bff" },
  notes:           { Cmp: NotebookPen,      color: "#ffb86c" },
  expense:         { Cmp: Wallet,           color: "#5fd38a" },
  "bottom-nav":    { Cmp: LayoutPanelLeft,  color: "#7eb2ff" },
  feed:            { Cmp: ImageIcon,        color: "#ff7e9a" },
  pwa:             { Cmp: Smartphone,       color: "#4f8cff" },
  onboarding:      { Cmp: Sparkles,         color: "#ffb86c" },
  fizzbuzz:        { Cmp: Hash,             color: "#7e5bff" },
  // language-themed template tiles use the brand logo (resolved below)
  python:          { Cmp: SiPython,         color: "#3776AB" },
  javascript:      { Cmp: SiJavascript,     color: "#F7DF1E" },
  typescript:      { Cmp: SiTypescript,     color: "#3178C6" },
  nodejs:          { Cmp: SiNodedotjs,      color: "#5FA04E" },
  java:            { Cmp: SiOpenjdk,        color: "#ED8B00" },
  cpp:             { Cmp: SiCplusplus,      color: "#00599C" },
  c:               { Cmp: SiC,              color: "#A8B9CC" },
  go:              { Cmp: SiGo,             color: "#00ADD8" },
  rust:            { Cmp: SiRust,           color: "#DEA584" },
  ruby:            { Cmp: SiRuby,           color: "#CC342D" },
  php:             { Cmp: SiPhp,            color: "#777BB4" },
  bash:            { Cmp: SiGnubash,        color: "#4EAA25" },
  csharp:          { Cmp: SiSharp,          color: "#239120" },
};

export interface IconBoxProps { name: string; size?: number; className?: string }

export function TemplateIcon({ name, size = 22, className }: IconBoxProps) {
  const spec = TEMPLATE_ICONS[name] ?? { Cmp: FileCode, color: "#9aa3cf" };
  const { Cmp, color } = spec;
  return <Cmp size={size} color={color} aria-hidden="true" className={className} />;
}

// ---------------------------------------------------------------------------
// Language brand logos (used in tabs, selectors, "kind" label, etc.)

const LANGUAGE_ICONS: Record<LangKey, IconSpec> = {
  python:     { Cmp: SiPython,      color: "#3776AB" },
  javascript: { Cmp: SiJavascript,  color: "#F7DF1E" },
  typescript: { Cmp: SiTypescript,  color: "#3178C6" },
  java:       { Cmp: SiOpenjdk,     color: "#ED8B00" },
  c:          { Cmp: SiC,           color: "#A8B9CC" },
  cpp:        { Cmp: SiCplusplus,   color: "#00599C" },
  csharp:     { Cmp: SiSharp,       color: "#239120" },
  php:        { Cmp: SiPhp,         color: "#777BB4" },
  go:         { Cmp: SiGo,          color: "#00ADD8" },
  rust:       { Cmp: SiRust,        color: "#DEA584" },
  ruby:       { Cmp: SiRuby,        color: "#CC342D" },
  bash:       { Cmp: SiGnubash,     color: "#4EAA25" },
  kotlin:     { Cmp: SiKotlin,      color: "#7F52FF" },
  swift:      { Cmp: SiSwift,       color: "#F05138" },
  dart:       { Cmp: SiDart,        color: "#0175C2" },
  scala:      { Cmp: SiScala,       color: "#DC322F" },
  objc:       { Cmp: SiApple,       color: "#A8B9CC" },
  sql:        { Cmp: Database,      color: "#7eb2ff" },
};

export function LanguageIcon({ language, size = 14, className }: { language: LangKey; size?: number; className?: string }) {
  const { Cmp, color } = LANGUAGE_ICONS[language];
  return <Cmp size={size} color={color} aria-hidden="true" className={className} />;
}

// ---------------------------------------------------------------------------
// File-extension icons (tab strip + file list)

const EXT_ICONS: Record<string, IconSpec> = {
  html:  { Cmp: SiHtml5,        color: "#E34F26" },
  htm:   { Cmp: SiHtml5,        color: "#E34F26" },
  css:   { Cmp: SiCss,         color: "#1572B6" },
  scss:  { Cmp: SiCss,         color: "#CC6699" },
  js:    { Cmp: SiJavascript,   color: "#F7DF1E" },
  mjs:   { Cmp: SiJavascript,   color: "#F7DF1E" },
  cjs:   { Cmp: SiJavascript,   color: "#F7DF1E" },
  ts:    { Cmp: SiTypescript,   color: "#3178C6" },
  tsx:   { Cmp: SiReact,        color: "#61DAFB" },
  jsx:   { Cmp: SiReact,        color: "#61DAFB" },
  json:  { Cmp: FileJson,       color: "#cbd5e1" },
  md:    { Cmp: FileText,       color: "#cbd5e1" },
  py:    { Cmp: SiPython,       color: "#3776AB" },
  java:  { Cmp: SiOpenjdk,      color: "#ED8B00" },
  php:   { Cmp: SiPhp,          color: "#777BB4" },
  rb:    { Cmp: SiRuby,         color: "#CC342D" },
  go:    { Cmp: SiGo,           color: "#00ADD8" },
  rs:    { Cmp: SiRust,         color: "#DEA584" },
  c:     { Cmp: SiC,            color: "#A8B9CC" },
  h:     { Cmp: SiC,            color: "#A8B9CC" },
  cpp:   { Cmp: SiCplusplus,    color: "#00599C" },
  cs:    { Cmp: SiSharp,        color: "#239120" },
  sh:    { Cmp: SiGnubash,      color: "#4EAA25" },
  sql:   { Cmp: Database,       color: "#7eb2ff" },
  xml:   { Cmp: Braces,         color: "#cbd5e1" },
  yml:   { Cmp: FileType,       color: "#cbd5e1" },
  yaml:  { Cmp: FileType,       color: "#cbd5e1" },
};

export function FileExtIcon({ name, size = 14, className }: { name: string; size?: number; className?: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const spec = EXT_ICONS[ext] ?? { Cmp: FileCode, color: "#9aa3cf" };
  const { Cmp, color } = spec;
  return <Cmp size={size} color={color} aria-hidden="true" className={className} />;
}

export { TerminalIcon };

// project.json manifest for ZIP export & re-import. Pure functions.
import type { RelFile } from "./relations";

export interface ProjectManifest {
  version: 1;
  name: string;
  kind: "web" | "code";
  language?: string;
  entry?: string;
  createdAt: string;
  files: { path: string; size: number; isAsset: boolean }[];
  folders: string[];
}

export function buildManifest(input: {
  name: string;
  kind: "web" | "code";
  language?: string;
  files: RelFile[];
  folders: string[];
}): ProjectManifest {
  const entry = pickEntry(input.kind, input.files);
  return {
    version: 1,
    name: input.name,
    kind: input.kind,
    language: input.language,
    entry,
    createdAt: new Date().toISOString(),
    folders: input.folders,
    files: input.files.map((f) => ({
      path: f.path,
      size: (f.content ?? "").length,
      isAsset: !!f.isAsset,
    })),
  };
}

function pickEntry(kind: "web" | "code", files: RelFile[]): string | undefined {
  if (kind === "web") return files.find((f) => f.path === "index.html")?.path
    ?? files.find((f) => /\.html?$/i.test(f.path))?.path;
  return files.find((f) => /^main\.|^index\./i.test(f.path))?.path ?? files[0]?.path;
}

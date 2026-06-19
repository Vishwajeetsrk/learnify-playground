import { createServerFn } from "@tanstack/react-start";

const OWNER = "Vishwajeetsrk";
const REPO = "learnify-playground";

export type RepoInfo = {
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  html_url: string;
};

export type Contributor = {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  contributions: number;
};

export type GhResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      kind: "not_found" | "rate_limit" | "unauthorized" | "network" | "unknown";
      status?: number;
      message: string;
      resetAt?: number; // epoch seconds for rate-limit reset
    };

function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "polyglot-orbit",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function ghFetch<T>(url: string): Promise<GhResult<T>> {
  try {
    const res = await fetch(url, { headers: buildHeaders() });
    if (res.ok) {
      return { ok: true, data: (await res.json()) as T };
    }
    const remaining = res.headers.get("x-ratelimit-remaining");
    const reset = res.headers.get("x-ratelimit-reset");
    if (res.status === 403 && remaining === "0") {
      return {
        ok: false,
        kind: "rate_limit",
        status: 403,
        message: "GitHub API rate limit reached. Try again shortly.",
        resetAt: reset ? Number(reset) : undefined,
      };
    }
    if (res.status === 401) {
      return { ok: false, kind: "unauthorized", status: 401, message: "GitHub token rejected." };
    }
    if (res.status === 404) {
      return { ok: false, kind: "not_found", status: 404, message: "Repository not found." };
    }
    return {
      ok: false,
      kind: "unknown",
      status: res.status,
      message: `GitHub returned ${res.status}.`,
    };
  } catch (e) {
    return {
      ok: false,
      kind: "network",
      message: e instanceof Error ? e.message : "Network error talking to GitHub.",
    };
  }
}

export const fetchRepoInfo = createServerFn({ method: "GET" }).handler(async () => {
  return await ghFetch<RepoInfo>(`https://api.github.com/repos/${OWNER}/${REPO}`);
});

export const fetchContributors = createServerFn({ method: "GET" })
  .inputValidator((input: { limit?: number; page?: number } | undefined) => ({
    limit: Math.min(Math.max(input?.limit ?? 12, 1), 100),
    page: Math.max(input?.page ?? 1, 1),
  }))
  .handler(async ({ data }) => {
    const result = await ghFetch<Contributor[]>(
      `https://api.github.com/repos/${OWNER}/${REPO}/contributors?per_page=${data.limit}&page=${data.page}`,
    );
    if (!result.ok) return result;
    const filtered = result.data.filter((c) => c.login && !c.login.includes("[bot]"));
    return { ok: true as const, data: filtered };
  });

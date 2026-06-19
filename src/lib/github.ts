import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { fetchContributors, fetchRepoInfo } from "./github.functions";
import type { GhResult, RepoInfo, Contributor } from "./github.functions";

export type { RepoInfo, Contributor, GhResult };

export const GITHUB_OWNER = "Vishwajeetsrk";
export const GITHUB_REPO = "learnify-playground";
export const GITHUB_REPO_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
export const GITHUB_OWNER_URL = `https://github.com/${GITHUB_OWNER}`;
export const GITHUB_CONTRIBUTORS_URL = `${GITHUB_REPO_URL}/graphs/contributors`;

export function useRepoStars() {
  const call = useServerFn(fetchRepoInfo);
  return useQuery({
    queryKey: ["github", "repo", GITHUB_OWNER, GITHUB_REPO],
    queryFn: () => call(),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  });
}

export function useContributors(limit = 8) {
  const call = useServerFn(fetchContributors);
  return useQuery({
    queryKey: ["github", "contributors", GITHUB_OWNER, GITHUB_REPO, limit],
    queryFn: () => call({ data: { limit } }),
    staleTime: 10 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
  });
}

export function formatCompact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  if (n < 1_000_000) return Math.round(n / 1000) + "k";
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}

export function describeGhError(r: GhResult<unknown> | undefined): string {
  if (!r || r.ok) return "";
  switch (r.kind) {
    case "not_found":
      return "Repository not found on GitHub yet.";
    case "rate_limit": {
      if (r.resetAt) {
        const mins = Math.max(1, Math.ceil((r.resetAt * 1000 - Date.now()) / 60_000));
        return `GitHub rate limit reached. Resets in ~${mins} min.`;
      }
      return "GitHub rate limit reached. Try again shortly.";
    }
    case "unauthorized":
      return "GitHub token was rejected.";
    case "network":
      return "Network error reaching GitHub.";
    default:
      return r.message || "Couldn't load from GitHub.";
  }
}

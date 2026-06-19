import { useQuery } from "@tanstack/react-query";

export const GITHUB_OWNER = "Vishwajeetsrk";
export const GITHUB_REPO = "learnify-playground";
export const GITHUB_REPO_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
export const GITHUB_OWNER_URL = `https://github.com/${GITHUB_OWNER}`;

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

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  return (await res.json()) as T;
}

export function useRepoStars() {
  return useQuery({
    queryKey: ["github", "repo", GITHUB_OWNER, GITHUB_REPO],
    queryFn: () =>
      fetchJson<RepoInfo>(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  });
}

export function useContributors(limit = 6) {
  return useQuery({
    queryKey: ["github", "contributors", GITHUB_OWNER, GITHUB_REPO, limit],
    queryFn: async () => {
      const list = await fetchJson<Contributor[]>(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contributors?per_page=${limit}`,
      );
      return list.filter((c) => c.login && !c.login.includes("[bot]")).slice(0, limit);
    },
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

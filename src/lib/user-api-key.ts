// User-supplied OpenRouter key, stored only in the browser (localStorage).
// Used as a fallback when the built-in AI quota is exhausted or rate-limited.
import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "polyglot-orbit:openrouter-key";

export function getUserApiKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setUserApiKey(key: string) {
  if (typeof window === "undefined") return;
  try {
    if (key) window.localStorage.setItem(STORAGE_KEY, key);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function useUserApiKey() {
  const [key, setKey] = useState<string>("");
  useEffect(() => {
    setKey(getUserApiKey());
  }, []);
  const save = useCallback((next: string) => {
    setUserApiKey(next.trim());
    setKey(next.trim());
  }, []);
  return { key, save, hasKey: key.length > 0 };
}

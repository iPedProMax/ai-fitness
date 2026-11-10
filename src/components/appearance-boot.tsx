"use client";
import { useEffect } from "react";

/** Resolve appearance without injecting a script element into React's tree. */
export function resolveAuraTheme(stored: string | null, systemDark: boolean): "dark" | "light" {
  if (stored === "dark") return "dark";
  if (stored === "light") return "light";
  return systemDark ? "dark" : "light";
}

export function AppearanceBoot() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function apply() {
      let stored: string | null = null;
      try { stored = window.localStorage.getItem("ai-fitness-appearance"); }
      catch { /* storage may be unavailable in private browsing */ }
      document.documentElement.setAttribute("data-aura-theme", resolveAuraTheme(stored, media.matches));
    }
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return null;
}

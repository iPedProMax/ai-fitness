"use client";

import { useEffect, useRef, useState } from "react";

type Appearance = "light" | "dark" | "system";
const STORAGE_KEY = "ai-fitness-appearance";
const SYSTEM_DARK = "(prefers-color-scheme: dark)";

/** The switch respects an existing System preference until the user clicks it. */
export function ThemeToggle() {
  const [appearance, setAppearance] = useState<Appearance>("system");
  const [systemDark, setSystemDark] = useState(false);
  const preferenceRef = useRef<Appearance>("system");
  const isDark = appearance === "dark" || (appearance === "system" && systemDark);

  useEffect(() => {
    const media = window.matchMedia(SYSTEM_DARK);
    let saved: Appearance = "system";
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      if (value === "light" || value === "dark" || value === "system") saved = value;
    } catch { /* Storage can be unavailable in private browsing. */ }
    preferenceRef.current = saved;
    setAppearance(saved);
    setSystemDark(media.matches);
    document.documentElement.setAttribute("data-aura-theme", saved === "dark" || (saved === "system" && media.matches) ? "dark" : "light");
    const onSystemChange = () => {
      setSystemDark(media.matches);
      if (preferenceRef.current === "system") {
        document.documentElement.setAttribute("data-aura-theme", media.matches ? "dark" : "light");
      }
    };
    const onAppearanceChanged = () => {
      let saved: Appearance = "system";
      try {
        const value = window.localStorage.getItem(STORAGE_KEY);
        if (value === "light" || value === "dark" || value === "system") saved = value;
      } catch { /* Storage may be unavailable. */ }
      preferenceRef.current = saved;
      setAppearance(saved);
      setSystemDark(media.matches);
      document.documentElement.setAttribute("data-aura-theme", saved === "dark" || (saved === "system" && media.matches) ? "dark" : "light");
    };
    media.addEventListener("change", onSystemChange);
    window.addEventListener("khalories-appearance-updated", onAppearanceChanged);
    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener("khalories-appearance-updated", onAppearanceChanged);
    };
  }, []);


  function toggle() {
    const next: Appearance = isDark ? "light" : "dark";
    preferenceRef.current = next;
    setAppearance(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); }
    catch { /* Switch still works when storage is blocked. */ }
    document.documentElement.setAttribute("data-aura-theme", next);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      title={`${appearance === "system" ? "Following system" : isDark ? "Dark mode" : "Light mode"} · Click to switch to ${isDark ? "light" : "dark"} mode`}
      onClick={toggle}
      className={`khalories-appearance-switch${isDark ? " khalories-appearance-switch--dark" : ""}`}
    >
      <span className="khalories-appearance-switch__rays" aria-hidden="true">✦</span>
      <span className="khalories-appearance-switch__stars" aria-hidden="true">✦</span>
      <span className="khalories-appearance-switch__thumb" aria-hidden="true">
        <svg className="khalories-appearance-switch__sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </svg>
        <svg className="khalories-appearance-switch__moon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.25 15.3A8.8 8.8 0 0 1 8.7 3.75 8.8 8.8 0 1 0 20.25 15.3Z" />
        </svg>
      </span>
    </button>
  );
}

"use client";
import { useEffect, useState } from "react";

type Appearance = "light" | "dark" | "system";
const key = "ai-fitness-appearance";
function applyAppearance(value: Appearance) {
  const dark = value === "dark" ||
    (value === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-aura-theme", dark ? "dark" : "light");
}
function AppearanceIcon({ value }: { value: Appearance }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
    {value === "light" ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></> :
    value === "dark" ? <path d="M20.2 15.7A8.5 8.5 0 0 1 8.3 3.8 8.5 8.5 0 1 0 20.2 15.7Z" /> :
    <><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8m-4-4v4m0-18v14"/></>}
  </svg>;
}
export function ThemeToggle() {
  const [appearance, setAppearance] = useState<Appearance>("system");
  useEffect(() => {
    let stored: Appearance = "system";
    try {
      const found = window.localStorage.getItem(key);
      if (found === "light" || found === "dark" || found === "system") stored = found;
    } catch { /* private browsing */ }
    setAppearance(stored);
    applyAppearance(stored);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => applyAppearance(stored);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return (
    <label className="aura-theme-control" title="Appearance">
      <AppearanceIcon value={appearance} />
      <select aria-label="Appearance" value={appearance} onChange={(event) => {
        const next = event.target.value as Appearance;
        setAppearance(next);
        try { window.localStorage.setItem(key, next); } catch { /* private browsing */ }
        applyAppearance(next);
      }}>
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}

"use client";
import { useEffect, useState } from "react";

type Appearance = "light" | "dark" | "system";
const key = "ai-fitness-appearance";
function applyAppearance(value: Appearance) {
  const dark = value === "dark" ||
    (value === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-aura-theme", dark ? "dark" : "light");
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
    <label className="aura-theme-control">
      <span aria-hidden="true">{appearance === "dark" ? "â˜¾" : appearance === "light" ? "â˜€" : "â—"}</span>
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
"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("carimarket-theme");
    const nextDark = stored === "dark";
    document.documentElement.dataset.theme = nextDark ? "dark" : "light";
    const frame = window.requestAnimationFrame(() => setDark(nextDark));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    window.localStorage.setItem("carimarket-theme", next ? "dark" : "light");
  }

  return <button className="theme-toggle" type="button" onClick={toggle} aria-label={dark ? "Gunakan tema terang" : "Gunakan tema gelap"} title={dark ? "Tema terang" : "Tema gelap"}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>;
}

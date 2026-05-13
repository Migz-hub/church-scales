import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Mode = "light" | "dark" | "system";

export interface ThemeColor {
  /** HSL string like "350 72% 42%" */
  hsl: string;
  /** glow variant (lighter) */
  glow: string;
}

interface ThemeContextValue {
  mode: Mode;
  setMode: (m: Mode) => void;
  color: string; // hex
  setColor: (hex: string) => void;
  reset: () => void;
}

const DEFAULT_COLOR = "#c1183a"; // mirrors original crimson primary
const STORAGE_KEY = "churchescales:theme";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = hex.replace("#", "");
  const bigint = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16);
  const r = ((bigint >> 16) & 255) / 255;
  const g = ((bigint >> 8) & 255) / 255;
  const b = (bigint & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function applyColor(hex: string) {
  const { h, s, l } = hexToHsl(hex);
  const root = document.documentElement;
  root.style.setProperty("--primary", `${h} ${s}% ${l}%`);
  root.style.setProperty("--ring", `${h} ${s}% ${l}%`);
  root.style.setProperty("--primary-glow", `${h} ${Math.min(s + 10, 100)}% ${Math.min(l + 13, 80)}%`);
  root.style.setProperty("--sidebar-primary", `${h} ${s}% ${l}%`);
  root.style.setProperty("--sidebar-ring", `${h} ${s}% ${l}%`);
}

function applyMode(mode: Mode) {
  const sys = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  const effective = mode === "system" ? sys : mode;
  document.documentElement.classList.toggle("light", effective === "light");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const initial = (() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as { mode: Mode; color: string };
    } catch { /* ignore */ }
    return { mode: "dark" as Mode, color: DEFAULT_COLOR };
  })();

  const [mode, setModeState] = useState<Mode>(initial.mode);
  const [color, setColorState] = useState<string>(initial.color);

  useEffect(() => {
    applyMode(mode);
    applyColor(color);
  }, [mode, color]);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const fn = () => applyMode("system");
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [mode]);

  const persist = (next: { mode: Mode; color: string }) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const setMode = (m: Mode) => {
    setModeState(m);
    persist({ mode: m, color });
  };
  const setColor = (hex: string) => {
    setColorState(hex);
    persist({ mode, color: hex });
  };
  const reset = () => {
    setModeState("dark");
    setColorState(DEFAULT_COLOR);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <ThemeContext.Provider value={{ mode, setMode, color, setColor, reset }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export const PRESET_COLORS = [
  "#3B82F6", "#3B4FB6", "#22C55E", "#EAB308", "#FACC15",
  "#8B5E3C", "#F59E0B", "#EF4444", "#EC4899", "#A855F7",
  "#7C3AED", "#14B8A6", "#06B6D4",
];

export { DEFAULT_COLOR };
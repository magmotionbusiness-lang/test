import { useEffect, useState } from 'react';
import type { HabitColor, ThemePref } from '@/db/types';
import { colorHex } from '@/lib/colors';

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function resolve(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') return media?.matches ? 'dark' : 'light';
  return pref;
}

/** Applies the theme to <html> and the iOS status bar / theme-color metas. */
export function applyTheme(pref: ThemePref): void {
  const mode = resolve(pref);
  document.documentElement.dataset.theme = mode;
  const color = mode === 'dark' ? '#000000' : '#F2F2F7';
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', color));
  try {
    localStorage.setItem('hh-theme', pref);
  } catch {
    /* storage may be unavailable; theme still applies for this session */
  }
}

export function useApplyTheme(pref: ThemePref | undefined): void {
  useEffect(() => {
    if (!pref) return;
    applyTheme(pref);
    if (pref !== 'system' || !media) return;
    const onChange = () => applyTheme('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [pref]);
}

export function useIsDark(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark');
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.dataset.theme === 'dark'));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

/** Sets the app-wide accent (`--accent`) from the palette, per theme. */
export function useApplyAccent(accent: HabitColor): void {
  const dark = useIsDark();
  useEffect(() => {
    const hex = colorHex(accent, dark).slice(1);
    const base = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    // Fill (white text on it): darken until 4.5:1.
    let fill = base;
    while (contrast(fill, WHITE) < 4.5) fill = fill.map((c) => Math.round(c * 0.94));
    // Text: 4.5:1 against the surfaces it sits on — darken in light mode, lighten in dark mode.
    let text = base;
    if (dark) while (contrast(text, DARK_FILL) < 4.5) text = text.map((c) => Math.round(c + (255 - c) * 0.08));
    else while (contrast(text, LIGHT_BG) < 4.5) text = text.map((c) => Math.round(c * 0.94));
    const root = document.documentElement.style;
    root.setProperty('--accent', text.join(' '));
    root.setProperty('--accent-fill', fill.join(' '));
  }, [accent, dark]);
}

const WHITE = [255, 255, 255];
/** systemGroupedBackground (light). */
const LIGHT_BG = [242, 242, 247];
/** A filled control on a dark card — the darkest surface accent text appears on. */
const DARK_FILL = [44, 44, 46];

function luminance([r, g, b]: number[]): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
}

function contrast(a: number[], b: number[]): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}

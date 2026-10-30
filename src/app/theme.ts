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
    const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');
    document.documentElement.style.setProperty('--accent', rgb);
  }, [accent, dark]);
}

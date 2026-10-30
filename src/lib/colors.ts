import type { HabitColor } from '@/db/types';

/**
 * iOS system colors. Dark variants are Apple's dark-mode values; a few light
 * values are deepened slightly (yellow, mint, cyan) so white checkmarks and
 * small tiles stay readable on light backgrounds.
 */
export const PALETTE: Record<HabitColor, { light: string; dark: string; label: string }> = {
  red: { light: '#FF3B30', dark: '#FF453A', label: 'Red' },
  orange: { light: '#FF9500', dark: '#FF9F0A', label: 'Orange' },
  yellow: { light: '#E6B800', dark: '#FFD60A', label: 'Yellow' },
  green: { light: '#34C759', dark: '#30D158', label: 'Green' },
  mint: { light: '#00B8AD', dark: '#63E6E2', label: 'Mint' },
  teal: { light: '#30B0C7', dark: '#40C8E0', label: 'Teal' },
  cyan: { light: '#1EA5D8', dark: '#64D2FF', label: 'Cyan' },
  blue: { light: '#007AFF', dark: '#0A84FF', label: 'Blue' },
  indigo: { light: '#5856D6', dark: '#5E5CE6', label: 'Indigo' },
  purple: { light: '#AF52DE', dark: '#BF5AF2', label: 'Purple' },
  pink: { light: '#FF2D55', dark: '#FF375F', label: 'Pink' },
  brown: { light: '#A2845E', dark: '#AC8E68', label: 'Brown' },
};

export const COLOR_NAMES = Object.keys(PALETTE) as HabitColor[];

export function colorHex(color: HabitColor, dark: boolean): string {
  return dark ? PALETTE[color].dark : PALETTE[color].light;
}

/** CSS custom property reference resolved by the theme — use in style props. */
export function colorVar(color: HabitColor): string {
  return `var(--c-${color})`;
}

/** Injects `--c-<name>` variables for both themes. Called once at startup. */
export function paletteCss(): string {
  const light = COLOR_NAMES.map((c) => `--c-${c}:${PALETTE[c].light};`).join('');
  const dark = COLOR_NAMES.map((c) => `--c-${c}:${PALETTE[c].dark};`).join('');
  return `:root{${light}}:root[data-theme='dark']{${dark}}`;
}

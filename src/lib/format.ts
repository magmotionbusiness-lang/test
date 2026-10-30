export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: n < 10 ? 1 : 0 }).format(n);
}

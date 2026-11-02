// Shared icon artwork: a 3×3 grid of rounded tiles filling in, on an indigo→blue gradient.
const FILLED = [1, 1, 0, 1, 1, 1, 0, 1, 1];

export function iconSvg({ size = 1024, inset = 0, rounded = false } = {}) {
  const s = size;
  const pad = s * (0.22 + inset);
  const gap = (s - pad * 2) * 0.08;
  const tile = (s - pad * 2 - gap * 2) / 3;
  const r = tile * 0.28;
  const tiles = FILLED.map((f, i) => {
    const x = pad + (i % 3) * (tile + gap);
    const y = pad + Math.floor(i / 3) * (tile + gap);
    return `<rect x="${x}" y="${y}" width="${tile}" height="${tile}" rx="${r}" fill="#fff" fill-opacity="${f ? 1 : 0.28}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5E5CE6"/><stop offset="1" stop-color="#0A84FF"/></linearGradient></defs>
<rect width="${s}" height="${s}" ${rounded ? `rx="${s * 0.225}"` : ''} fill="url(#g)"/>${tiles}</svg>`;
}

/** Brand colour behind the launch logo (iOS splash screens and the in-app intro). */
export const MATTE = '#3F4BDB';

/** The 3×3 tile mark on its own, in a 100×100 box (same geometry as src/components/Intro.tsx). */
export function logoSvg(size, color = '#fff') {
  const gap = 8;
  const tile = (100 - 2 * gap) / 3;
  const tiles = FILLED.map((f, i) => {
    const x = (i % 3) * (tile + gap);
    const y = Math.floor(i / 3) * (tile + gap);
    return `<rect x="${x}" y="${y}" width="${tile}" height="${tile}" rx="${tile * 0.28}" fill="${color}" fill-opacity="${f ? 1 : 0.28}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${tiles}</svg>`;
}

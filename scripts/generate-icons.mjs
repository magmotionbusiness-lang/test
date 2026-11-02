// Renders app icons and iOS splash screens with the preinstalled Chromium.
// Usage: npm run icons  (writes public/icons, public/splash, public/favicon.svg, splash-links.html)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Playwright is preinstalled globally in the build container; not a project dependency.
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright');
import { mkdirSync, writeFileSync } from 'node:fs';
import { iconSvg, logoSvg, MATTE } from './icon.mjs';

const root = new URL('../public/', import.meta.url);
mkdirSync(new URL('icons/', root), { recursive: true });
mkdirSync(new URL('splash/', root), { recursive: true });

// Portrait CSS width × height @ pixel ratio. iPads also get landscape.
const DEVICES = [
  [440, 956, 3],
  [402, 874, 3],
  [430, 932, 3],
  [393, 852, 3],
  [428, 926, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 896, 3],
  [414, 896, 2],
  [414, 736, 3],
  [375, 667, 2],
  [320, 568, 2],
  [1032, 1376, 2, true],
  [1024, 1366, 2, true],
  [834, 1210, 2, true],
  [834, 1194, 2, true],
  [820, 1180, 2, true],
  [834, 1112, 2, true],
  [810, 1080, 2, true],
  [768, 1024, 2, true],
  [744, 1133, 2, true],
];

const browser = await chromium.launch();
const page = await browser.newPage();

async function render(svgOrHtml, w, h, out) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0">${svgOrHtml}</body></html>`);
  await page.screenshot({ path: new URL(out, root).pathname, omitBackground: false });
}

writeFileSync(new URL('favicon.svg', root), iconSvg({ size: 64, rounded: true }));
await render(iconSvg({ size: 180 }), 180, 180, 'icons/apple-touch-icon-180.png');
await render(iconSvg({ size: 167 }), 167, 167, 'icons/apple-touch-icon-167.png');
await render(iconSvg({ size: 152 }), 152, 152, 'icons/apple-touch-icon-152.png');
await render(iconSvg({ size: 192 }), 192, 192, 'icons/icon-192.png');
await render(iconSvg({ size: 512 }), 512, 512, 'icons/icon-512.png');
await render(iconSvg({ size: 512, inset: 0.08 }), 512, 512, 'icons/icon-maskable-512.png');

const links = [];
for (const [cw, ch, dpr, ipad] of DEVICES) {
  const orientations = ipad ? ['portrait', 'landscape'] : ['portrait'];
  for (const o of orientations) {
    for (const scheme of ['light', 'dark']) {
      const w = (o === 'portrait' ? cw : ch) * dpr;
      const h = (o === 'portrait' ? ch : cw) * dpr;
      // Same matte + logo in both schemes; the in-app intro starts from exactly this frame.
      // No watermark here: the intro animates it in (src/components/Intro.tsx).
      const icon = Math.round(Math.min(w, h) * 0.22);
      const html = `<div style="width:${w}px;height:${h}px;background:${MATTE};display:flex;align-items:center;justify-content:center">${logoSvg(icon)}</div>`;
      // Versioned names, so iOS fetches the new launch pictures instead of reusing cached ones.
      const file = `splash/${w}x${h}-${scheme}-v2.png`;
      await render(html, w, h, file);
      links.push(
        `<link rel="apple-touch-startup-image" media="screen and (device-width: ${cw}px) and (device-height: ${ch}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: ${o}) and (prefers-color-scheme: ${scheme})" href="/${file}" />`,
      );
    }
  }
}
writeFileSync(new URL('../scripts/splash-links.html', import.meta.url), links.join('\n') + '\n');
await browser.close();
console.log(`Wrote icons and ${links.length} splash screens.`);

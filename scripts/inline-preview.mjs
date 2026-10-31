// Turns dist-preview/ into one self-contained HTML fragment for a claude.ai
// artifact: inlines the CSS and the (single) JS bundle; the page skeleton is
// added by the host. Usage: npm run build:preview
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const dir = new URL('../dist-preview/', import.meta.url);
const assets = readdirSync(new URL('assets/', dir));
const js = assets.filter((f) => f.endsWith('.js'));
if (js.length !== 1) throw new Error(`expected one JS bundle, found ${js.join(', ')}`);
const css = assets
  .filter((f) => f.endsWith('.css'))
  .map((f) => readFileSync(new URL(`assets/${f}`, dir), 'utf8'))
  .join('\n');
const code = readFileSync(new URL(`assets/${js[0]}`, dir), 'utf8').replace(/<\/script/gi, '<\\/script');

const html = `<title>Habit Hub</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#F2F2F7">
<style>${css}</style>
<script>
  (function () {
    var dark = matchMedia('(prefers-color-scheme: dark)').matches;
    try { var p = localStorage.getItem('hh-theme'); if (p === 'dark') dark = true; if (p === 'light') dark = false; } catch (e) {}
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  })();
</script>
<div id="root"></div>
<script type="module">${code}</script>
`;
writeFileSync(new URL('habit-hub.html', dir), html);
console.log(`Wrote dist-preview/habit-hub.html (${(html.length / 1024).toFixed(0)} KB)`);

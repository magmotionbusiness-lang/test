import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { App } from './app/App';
import { paletteCss } from './lib/colors';
import { installAudioUnlock } from './lib/sound';
import './styles/index.css';

const style = document.createElement('style');
style.textContent = paletteCss();
document.head.appendChild(style);

// Dynamic Type: iOS reports the user's preferred text size through the
// -apple-system-body font. Scale all typography by it (spacing stays on the
// 8-pt grid). Other browsers don't know the keyword and keep scale 1.
function applyDynamicType() {
  const probe = document.createElement('span');
  probe.style.font = '-apple-system-body';
  if (!probe.style.font) return;
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  document.body.appendChild(probe);
  const size = parseFloat(getComputedStyle(probe).fontSize);
  probe.remove();
  if (size) document.documentElement.style.setProperty('--type-scale', String(Math.min(1.5, Math.max(0.85, size / 17))));
}
applyDynamicType();
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && applyDynamicType());

installAudioUnlock();

// Ask iOS/Safari not to evict our IndexedDB under storage pressure.
void navigator.storage?.persist?.().catch(() => undefined);

// The claude.ai preview build has no service worker and routes in memory.
const preview = import.meta.env.VITE_PREVIEW === 'true';
if (!preview)
  void import('virtual:pwa-register').then(({ registerSW }) => {
    // iOS often resumes a Home Screen app without reloading it, so a new version
    // would wait for a full restart. Check for one whenever the app comes back to
    // the foreground and every 30 minutes; a found update reloads the app in place.
    registerSW({
      immediate: true,
      onRegisteredSW(_url, reg) {
        if (!reg) return;
        const check = () => void reg.update().catch(() => undefined);
        document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
        setInterval(check, 30 * 60 * 1000);
      },
    });
  });
const Router = preview ? MemoryRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
);

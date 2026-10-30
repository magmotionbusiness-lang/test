import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { paletteCss } from './lib/colors';
import './styles/index.css';

const style = document.createElement('style');
style.textContent = paletteCss();
document.head.appendChild(style);

// Ask iOS/Safari not to evict our IndexedDB under storage pressure.
void navigator.storage?.persist?.().catch(() => undefined);

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MotionConfig>
  </StrictMode>,
);

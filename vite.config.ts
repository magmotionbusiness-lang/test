import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import pkg from './package.json' with { type: 'json' };

// `vite build --mode artifact` makes a single-page preview (no service worker,
// one inlined bundle) for viewing on claude.ai; see scripts/inline-preview.mjs.
export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    // Shown in Settings so it's easy to tell which build a device is running.
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  base: mode === 'artifact' ? './' : '/',
  build:
    mode === 'artifact'
      ? { outDir: 'dist-preview', assetsInlineLimit: Number.MAX_SAFE_INTEGER, rollupOptions: { output: { inlineDynamicImports: true } } }
      : undefined,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      ...(mode === 'artifact' ? { 'virtual:pwa-register': fileURLToPath(new URL('./src/lib/pwa-stub.ts', import.meta.url)) } : {}),
    },
  },
  plugins: [
    react(),
    mode !== 'artifact' &&
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          id: '/',
          name: 'Habit Hub',
          short_name: 'Habit Hub',
          description: 'Track habits by section, watch your tiles fill, and get calm AI coaching.',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'any',
          background_color: '#F2F2F7',
          theme_color: '#F2F2F7',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,woff2}', 'icons/*.png'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
        },
      }),
  ],
}));

/** Stand-in for `virtual:pwa-register` in the preview build, which has no service worker. */
export function registerSW(_options?: unknown): () => Promise<void> {
  return async () => undefined;
}

/** Stand-in for `virtual:pwa-register` in the preview build, which has no service worker. */
export function registerSW(_options?: {
  immediate?: boolean;
  onRegisteredSW?: (url: string, reg: ServiceWorkerRegistration | undefined) => void;
}): () => Promise<void> {
  return async () => undefined;
}

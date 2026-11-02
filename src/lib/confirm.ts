/**
 * Native confirm dialog. The claude.ai preview viewer blocks dialogs
 * (confirm() always returns false there), so the preview build accepts.
 */
export function confirmAction(message: string): boolean {
  if (import.meta.env.VITE_PREVIEW === 'true') return true;
  return window.confirm(message);
}

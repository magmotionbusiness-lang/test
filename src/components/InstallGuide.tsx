import { Share, SquarePlus } from 'lucide-react';
import { Sheet } from './Sheet';

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && !isStandalone();
}

const STEPS = [
  { icon: <Share size={20} aria-hidden />, text: 'Tap the Share button in Safari’s toolbar.' },
  { icon: <SquarePlus size={20} aria-hidden />, text: 'Scroll down and tap “Add to Home Screen”.' },
  { icon: <span className="text-[15px] font-semibold">Add</span>, text: 'Tap “Add” in the top-right corner.' },
];

export function InstallGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Install Habit Hub">
      <div className="flex flex-col items-center pb-2 pt-2 text-center">
        <img src="/icons/icon-192.png" alt="" className="h-20 w-20 rounded-[18px] shadow-card" />
        <p className="mt-4 max-w-xs text-subhead text-secondary">
          Add Habit Hub to your Home Screen. It opens full-screen, works offline and feels like a real app.
        </p>
      </div>
      <ol className="mt-6 overflow-hidden rounded-row bg-bg-2">
        {STEPS.map((s, i) => (
          <li key={i} className="flex items-center gap-3 border-[rgb(var(--separator)/0.29)] px-4 py-3 [&+&]:border-t">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--fill)/0.16)] text-accent">{s.icon}</span>
            <span className="text-body">
              <span className="text-secondary">{i + 1}. </span>
              {s.text}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-4 px-2 text-center text-footnote text-secondary">
        On iPad, the Share button is in the top-right of Safari. Install first: iOS keeps the Home Screen app’s data separate from Safari’s.
      </p>
    </Sheet>
  );
}

import { playCompletionSound, playTapSound } from './sound';

/**
 * Tap feedback for finishing a habit: a light vibration plus a short sound.
 * Must be called synchronously inside the tap handler (iOS only allows both
 * during a user gesture).
 */

let soundOn = true;
let ownSoundEachDone = false;
/** Kept in sync with Settings by the app shell. */
export function setFeedbackPrefs(prefs: { tapSound: boolean; ownSoundEachDone: boolean }): void {
  soundOn = prefs.tapSound;
  ownSoundEachDone = prefs.ownSoundEachDone;
}

let hapticLabel: HTMLLabelElement | null = null;

/**
 * iOS 18+ plays the system "selection" vibration when a switch control is
 * toggled, and web pages can't vibrate any other way on iPhone. Toggling a
 * hidden switch is the one way in; elsewhere it falls back to the Vibration API.
 */
export function haptic(): void {
  if (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    if (!hapticLabel) {
      const wrap = document.createElement('div');
      wrap.setAttribute('aria-hidden', 'true');
      wrap.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.id = 'hh-haptic';
      input.tabIndex = -1;
      hapticLabel = document.createElement('label');
      hapticLabel.htmlFor = 'hh-haptic';
      wrap.append(input, hapticLabel);
      document.body.append(wrap);
    }
    hapticLabel.click();
  } else navigator.vibrate?.(12);
}

/** Feedback for a tap that completes a habit ('done') or only adds progress ('tick'). */
export function rewardTap(kind: 'done' | 'tick'): void {
  haptic();
  // With "Play my sound: on every Done", the user's own sound replaces the pop.
  if (kind === 'done' && ownSoundEachDone) void playCompletionSound();
  else if (soundOn) playTapSound(kind);
}

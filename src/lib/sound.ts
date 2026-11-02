import { db } from '@/db/db';
import { nowIso } from '@/lib/id';

/**
 * Completion sound. Uses Web Audio: iOS only lets a page play sound after a
 * user gesture, so the context is unlocked on the first tap, and later sounds
 * (fired from a database update, not a tap) then play reliably.
 */

const SOUND_ID = 'completion-sound';
const MAX_SECONDS = 8;

type AudioCtor = typeof AudioContext;
let ctx: AudioContext | null = null;
let custom: AudioBuffer | null | undefined; // undefined = not loaded yet

function context(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor: AudioCtor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

/** Call once at startup: unlocks audio on the first touch or click. */
export function installAudioUnlock(): void {
  const unlock = () => {
    const c = context();
    if (!c) return;
    void c.resume();
    // Playing a one-sample silent buffer inside the gesture unlocks iOS.
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, 22050);
    src.connect(c.destination);
    src.start(0);
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

async function loadCustom(c: AudioContext): Promise<AudioBuffer | null> {
  if (custom !== undefined) return custom;
  const row = await db.blobs.get(SOUND_ID);
  custom = row ? await c.decodeAudioData(await row.blob.arrayBuffer()).catch(() => null) : null;
  return custom;
}

/** Plays the user's sound if they chose one, otherwise a short built-in chime. */
export async function playCompletionSound(): Promise<void> {
  const c = context();
  if (!c) return;
  if (c.state !== 'running') await c.resume().catch(() => undefined);
  const buffer = await loadCustom(c);
  if (buffer) {
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.connect(c.destination);
    src.start();
  } else chime(c);
}

/** A bright three-note rising chime, synthesised so the app ships no audio files. */
function chime(c: AudioContext): void {
  const t0 = c.currentTime + 0.02;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const t = t0 + i * 0.11;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.28, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (i === 3 ? 0.9 : 0.35));
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 1);
  });
}

/**
 * Saves a user-picked audio (or video) file as their completion sound. The
 * audio is decoded, trimmed of leading/trailing silence, capped at 8 s and
 * stored on the device as a small WAV, so a 12 MB screen recording becomes a
 * few hundred KB.
 */
export async function setCustomSound(file: File): Promise<void> {
  const c = context();
  if (!c) throw new Error('This device can’t play audio.');
  let decoded: AudioBuffer;
  try {
    decoded = await c.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error('That file has no sound this device can play. Try an audio file (.m4a, .mp3, .wav) or a screen recording.');
  }
  const trimmed = trimSilence(decoded, c);
  const blob = encodeWav(trimmed);
  await db.blobs.put({ id: SOUND_ID, blob, updatedAt: nowIso() });
  custom = trimmed;
}

export async function clearCustomSound(): Promise<void> {
  await db.blobs.delete(SOUND_ID);
  custom = null;
}

function trimSilence(buf: AudioBuffer, c: AudioContext): AudioBuffer {
  const data = buf.getChannelData(0);
  const threshold = 0.01;
  let start = 0;
  while (start < data.length && Math.abs(data[start]!) < threshold) start++;
  let end = data.length - 1;
  while (end > start && Math.abs(data[end]!) < threshold) end--;
  end = Math.min(end + Math.floor(buf.sampleRate * 0.05), data.length - 1, start + buf.sampleRate * MAX_SECONDS);
  const length = Math.max(1, end - start + 1);
  const out = c.createBuffer(1, length, buf.sampleRate);
  const dst = out.getChannelData(0);
  // Downmix to mono.
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const src = buf.getChannelData(ch);
    for (let i = 0; i < length; i++) dst[i]! += src[start + i]! / buf.numberOfChannels;
  }
  // Short fade-out so a cut never clicks.
  const fade = Math.min(length, Math.floor(buf.sampleRate * 0.08));
  for (let i = 0; i < fade; i++) dst[length - 1 - i]! *= i / fade;
  return out;
}

function encodeWav(buf: AudioBuffer): Blob {
  const samples = buf.getChannelData(0);
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(bytes);
  const str = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, buf.sampleRate, true);
  v.setUint32(28, buf.sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i]!)) * 0x7fff, true);
  return new Blob([bytes], { type: 'audio/wav' });
}

/** Short UI sounds for tapping Done: a bright two-note "pop" for completing, a soft tick for +1. */
export function playTapSound(kind: 'done' | 'tick'): void {
  const c = context();
  if (!c) return;
  if (c.state !== 'running') void c.resume();
  const t0 = c.currentTime + 0.005;
  const notes = kind === 'done' ? [880, 1318.5] : [740];
  notes.forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    const t = t0 + i * 0.07;
    osc.frequency.setValueAtTime(freq * 0.9, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.03);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(kind === 'done' ? 0.16 : 0.08, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'done' ? 0.22 : 0.09));
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  });
}

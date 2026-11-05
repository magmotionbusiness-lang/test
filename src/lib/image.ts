import { fitWithin } from '@/domain/vision';

/** Longest side of a stored vision board photo, in pixels: sharp on any iPhone or iPad, still small. */
const MAX_SIDE = 1600;

/**
 * Decodes a picked photo (respecting its orientation), scales it down and
 * re-encodes it as JPEG, so a 12 MP camera shot becomes a few hundred KB.
 */
export async function preparePhoto(file: Blob): Promise<{ blob: Blob; aspect: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new Error('That file couldn’t be opened as a photo.');
    }
    const { w, h } = fitWithin(img.naturalWidth, img.naturalHeight, MAX_SIDE);
    if (!w || !h) throw new Error('That photo looks empty.');
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your device couldn’t process that photo.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    if (!blob) throw new Error('Your device couldn’t process that photo.');
    return { blob, aspect: w / h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`;
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

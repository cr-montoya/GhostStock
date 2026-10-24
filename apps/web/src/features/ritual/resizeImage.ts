import { IMAGE_CONTENT_TYPES, MAX_UPLOAD_BYTES, type ImageContentType } from "@ghoststock/contracts";

export const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;
export const MAX_LONG_EDGE = 1568;
const KEEP_ORIGINAL_BYTES = 1_500_000;

export type ImageCheck = { ok: true } | { ok: false; reason: "type" | "original-size" };

export function checkImageFile(file: File): ImageCheck {
  if (!(IMAGE_CONTENT_TYPES as readonly string[]).includes(file.type)) return { ok: false, reason: "type" };
  if (file.size > MAX_ORIGINAL_BYTES) return { ok: false, reason: "original-size" };
  return { ok: true };
}

export interface ProcessedImage {
  blob: Blob;
  contentType: ImageContentType;
  width: number;
  height: number;
}

export class ImageTooLargeError extends Error {
  constructor() {
    super("processed image exceeds MAX_UPLOAD_BYTES");
    this.name = "ImageTooLargeError";
  }
}

/** Long edge at most `max`, aspect ratio kept, never upscaled. */
export function fitWithin(width: number, height: number, max = MAX_LONG_EDGE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export type Encoder = (bitmap: ImageBitmap, width: number, height: number, quality: number) => Promise<Blob>;

async function canvasEncode(bitmap: ImageBitmap, width: number, height: number, quality: number): Promise<Blob> {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("2d context unavailable");
    // JPEG has no alpha: paint white first so transparent PNGs do not turn black.
  context.fillStyle = "white";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
    return canvas.convertToBlob({ type: "image/jpeg", quality });
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2d context unavailable");
  // JPEG has no alpha: paint white first so transparent PNGs do not turn black.
  context.fillStyle = "white";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))), "image/jpeg", quality),
  );
}

/**
 * Downscales to 1568 px on the long edge and re-encodes as JPEG 0.85 (0.7 on a second
 * try). The original is kept when it is already small enough (spec 02, 3.3 and 3.4).
 */
export async function resizeImage(file: File, encode: Encoder = canvasEncode): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const fits = width === bitmap.width && height === bitmap.height;
    if (fits && file.size < KEEP_ORIGINAL_BYTES) {
      return { blob: file, contentType: file.type as ImageContentType, width, height };
    }
    let blob = await encode(bitmap, width, height, 0.85);
    if (blob.size > MAX_UPLOAD_BYTES) blob = await encode(bitmap, width, height, 0.7);
    if (blob.size > MAX_UPLOAD_BYTES) throw new ImageTooLargeError();
    return { blob, contentType: "image/jpeg", width, height };
  } finally {
    bitmap.close();
  }
}

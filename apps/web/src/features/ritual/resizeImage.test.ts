import { MAX_UPLOAD_BYTES } from "@ghoststock/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImageTooLargeError, MAX_ORIGINAL_BYTES, checkImageFile, fitWithin, resizeImage, type Encoder } from "./resizeImage";

const file = (type: string, size: number, name = "foto") => {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
};

describe("checkImageFile", () => {
  it("[02 3.2] rejects types other than jpeg, png and webp", () => {
    expect(checkImageFile(file("image/gif", 10))).toEqual({ ok: false, reason: "type" });
    expect(checkImageFile(file("application/pdf", 10))).toEqual({ ok: false, reason: "type" });
  });

  it("[02 3.2] rejects originals over 25 MB", () => {
    expect(checkImageFile(file("image/jpeg", MAX_ORIGINAL_BYTES + 1))).toEqual({ ok: false, reason: "original-size" });
    expect(checkImageFile(file("image/webp", MAX_ORIGINAL_BYTES))).toEqual({ ok: true });
  });
});

describe("fitWithin", () => {
  it("[02 3.3] keeps the long edge at most 1568 px and the aspect ratio", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1568, height: 1176 });
    expect(fitWithin(1000, 3136)).toEqual({ width: 500, height: 1568 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("resizeImage", () => {
  let size = { width: 4000, height: 3000 };
  const close = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ ...size, close })));
  });
  afterEach(() => vi.unstubAllGlobals());

  const encoderReturning = (...sizes: number[]) => {
    const calls: number[] = [];
    const encoder: Encoder = async (_bitmap, _w, _h, quality) => {
      calls.push(quality);
      return new Blob([new Uint8Array(sizes[calls.length - 1] ?? 1)], { type: "image/jpeg" });
    };
    return { encoder, calls };
  };

  it("[02 3.3] downscales and re-encodes as JPEG at 0.85", async () => {
    size = { width: 4000, height: 3000 };
    const { encoder, calls } = encoderReturning(900_000);
    const result = await resizeImage(file("image/png", 9_000_000), encoder);
    expect(calls).toEqual([0.85]);
    expect(result).toMatchObject({ contentType: "image/jpeg", width: 1568, height: 1176 });
    expect(close).toHaveBeenCalled();
  });

  it("[02 3.3] keeps a small original untouched", async () => {
    size = { width: 1200, height: 900 };
    const { encoder, calls } = encoderReturning();
    const original = file("image/webp", 400_000);
    const result = await resizeImage(original, encoder);
    expect(calls).toEqual([]);
    expect(result.blob).toBe(original);
    expect(result.contentType).toBe("image/webp");
  });

  it("[02 3.3] re-encodes a photo that fits but weighs 1.5 MB or more", async () => {
    size = { width: 1200, height: 900 };
    const { encoder, calls } = encoderReturning(300_000);
    const result = await resizeImage(file("image/jpeg", 1_500_000), encoder);
    expect(calls).toEqual([0.85]);
    expect(result).toMatchObject({ contentType: "image/jpeg", width: 1200, height: 900 });
  });

  it("[02 3.3] decodes with the EXIF orientation applied", async () => {
    size = { width: 4000, height: 3000 };
    await resizeImage(file("image/jpeg", 9_000_000), encoderReturning(1).encoder);
    expect(createImageBitmap).toHaveBeenCalledWith(expect.any(File), { imageOrientation: "from-image" });
  });

  it("[02 3.4] retries at quality 0.7 when the first encode is too large", async () => {
    size = { width: 4000, height: 3000 };
    const { encoder, calls } = encoderReturning(MAX_UPLOAD_BYTES + 1, 2_000_000);
    const result = await resizeImage(file("image/jpeg", 20_000_000), encoder);
    expect(calls).toEqual([0.85, 0.7]);
    expect(result.blob.size).toBe(2_000_000);
  });

  it("[02 3.4] fails with the size error when 0.7 is still too large", async () => {
    size = { width: 4000, height: 3000 };
    const { encoder } = encoderReturning(MAX_UPLOAD_BYTES + 1, MAX_UPLOAD_BYTES + 1);
    await expect(resizeImage(file("image/jpeg", 20_000_000), encoder)).rejects.toBeInstanceOf(ImageTooLargeError);
  });
});

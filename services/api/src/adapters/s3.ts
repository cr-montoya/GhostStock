import { CopyObjectCommand, GetObjectCommand, HeadObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { MAX_UPLOAD_BYTES, type ImageContentType } from "@ghoststock/contracts";
import { AppError } from "../lib/errors.js";

const MISSING = new Set(["NotFound", "NoSuchKey"]);

/** A missing object is `IMAGE_NOT_FOUND`; any other S3 failure is `STORAGE_ERROR`. */
function mapS3Error(error: unknown): AppError {
  const name = error instanceof Error ? error.name : "";
  return new AppError(MISSING.has(name) ? "IMAGE_NOT_FOUND" : "STORAGE_ERROR", undefined, error);
}

export interface ImageHead {
  contentLength: number;
  contentType: string | undefined;
}

export async function headImage(s3: S3Client, bucket: string, key: string): Promise<ImageHead> {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { contentLength: head.ContentLength ?? 0, contentType: head.ContentType };
  } catch (error) {
    throw mapS3Error(error);
  }
}

/** The kept photo key for an upload: `media/products/<id>.<ext>`, same extension. */
export function mediaKeyFor(imageKey: string, id: string): string {
  return `media/products/${id}.${imageKey.slice(imageKey.lastIndexOf(".") + 1)}`;
}

/**
 * Copies the raw upload to its kept media key. Both keys must already match the
 * contract key patterns (ULID and extension only), so the CopySource needs no encoding.
 * A source that expired or never existed is `IMAGE_NOT_FOUND`.
 */
export async function copyToMedia(s3: S3Client, bucket: string, imageKey: string, mediaKey: string): Promise<void> {
  try {
    await s3.send(new CopyObjectCommand({ Bucket: bucket, Key: mediaKey, CopySource: `${bucket}/${imageKey}` }));
  } catch (error) {
    throw mapS3Error(error);
  }
}

/** Converse needs the bytes; it does not accept S3 URLs (ai-integration.md). */
export async function getImageBytes(s3: S3Client, bucket: string, key: string): Promise<Uint8Array> {
  try {
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!object.Body) throw new AppError("STORAGE_ERROR", "Empty object body");
    return await object.Body.transformToByteArray();
  } catch (error) {
    throw error instanceof AppError ? error : mapS3Error(error);
  }
}

export const PRESIGN_EXPIRES_SECONDS = 300;

export interface PresignedUpload {
  url: string;
  fields: Record<string, string>;
}

/**
 * Presigned POST for one exact key: the policy pins the key (added by the SDK), the
 * content type and the 1 to 3 750 000 byte range, and expires in 300 s (security.md).
 * Signing is local; no S3 request is made.
 */
export async function presignPost(
  s3: S3Client,
  bucket: string,
  key: string,
  contentType: ImageContentType,
): Promise<PresignedUpload> {
  return createPresignedPost(s3, {
    Bucket: bucket,
    Key: key,
    Fields: { "Content-Type": contentType },
    Conditions: [
      ["content-length-range", 1, MAX_UPLOAD_BYTES],
      ["eq", "$Content-Type", contentType],
    ],
    Expires: PRESIGN_EXPIRES_SECONDS,
  });
}

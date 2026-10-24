import type { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { MAX_UPLOAD_BYTES, type ImageContentType } from "@ghoststock/contracts";

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

import type { S3Client } from "@aws-sdk/client-s3";
import {
  CreateUploadResponseSchema,
  IMAGE_EXTENSIONS,
  type CreateUploadRequest,
  type CreateUploadResponse,
} from "@ghoststock/contracts";
import { PRESIGN_EXPIRES_SECONDS, presignPost } from "../adapters/s3.js";
import { ulid } from "../lib/ids.js";

export interface UploadsDeps {
  s3: S3Client;
  bucket: string;
  now?: () => Date;
}

/** Issues an upload slot for `tmp/<ulid>.<ext>`; the server picks the key, never the client. */
export async function createUploadSlot(deps: UploadsDeps, request: CreateUploadRequest): Promise<CreateUploadResponse> {
  const issuedAt = (deps.now ?? (() => new Date()))();
  const imageKey = `tmp/${ulid()}.${IMAGE_EXTENSIONS[request.contentType]}`;
  const { url, fields } = await presignPost(deps.s3, deps.bucket, imageKey, request.contentType);
  return CreateUploadResponseSchema.parse({
    url,
    fields,
    imageKey,
    expiresAt: new Date(issuedAt.getTime() + PRESIGN_EXPIRES_SECONDS * 1000).toISOString(),
  });
}

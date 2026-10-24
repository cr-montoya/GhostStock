import { S3Client } from "@aws-sdk/client-s3";
import { CreateUploadRequestSchema, classifyUploadRequestError } from "@ghoststock/contracts";
import { UploadsEnvSchema, envLoader } from "../lib/env.js";
import { json, parseJson, withErrors } from "../lib/http.js";
import { createUploadSlot } from "../services/uploads.js";

const env = envLoader(UploadsEnvSchema);
const s3 = new S3Client({});

/** POST /api/uploads */
export const handler = withErrors(async (event) => {
  const request = parseJson(event, CreateUploadRequestSchema, classifyUploadRequestError);
  const slot = await createUploadSlot({ s3, bucket: env().MEDIA_BUCKET }, request);
  return json(201, slot);
});

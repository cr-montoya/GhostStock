import {
  CreateUploadResponseSchema,
  type CreateUploadRequest,
  type CreateUploadResponse,
} from "@ghoststock/contracts";
import { ApiClientError, apiFetch } from "./client";

export function createUpload(request: CreateUploadRequest): Promise<CreateUploadResponse> {
  return apiFetch("/api/uploads", { method: "POST", body: request }, CreateUploadResponseSchema);
}

/** Posts the file to S3 with the presigned fields; the file goes last, as S3 requires. */
export async function postToS3(upload: CreateUploadResponse, file: Blob): Promise<void> {
  const form = new FormData();
  for (const [key, value] of Object.entries(upload.fields)) form.append(key, value);
  form.append("file", file);

  let response: Response;
  try {
    response = await fetch(upload.url, { method: "POST", body: form });
  } catch {
    throw new ApiClientError("NETWORK", { retryable: true });
  }
  if (!response.ok) {
    // S3 answers with XML; an expired policy or a rejected size is not worth parsing.
    throw new ApiClientError("UNEXPECTED", { retryable: true, status: response.status });
  }
}

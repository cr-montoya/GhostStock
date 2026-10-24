import { z } from "zod";

export const CATEGORIES = [
  "alimentos",
  "bebidas",
  "aseo",
  "belleza",
  "hogar",
  "ferreteria",
  "electronica",
  "papeleria",
  "ropa",
  "juguetes",
  "mascotas",
  "otros",
] as const;

export const Category = z.enum(CATEGORIES);
export type Category = z.infer<typeof Category>;

export const CATEGORY_LABELS: Record<Category, string> = {
  alimentos: "Alimentos",
  bebidas: "Bebidas",
  aseo: "Aseo",
  belleza: "Belleza",
  hogar: "Hogar",
  ferreteria: "Ferretería",
  electronica: "Electrónica",
  papeleria: "Papelería",
  ropa: "Ropa",
  juguetes: "Juguetes",
  mascotas: "Mascotas",
  otros: "Otros",
};

const ULID_PATTERN = "[0-9A-HJKMNP-TV-Z]{26}";

export const Ulid = z.string().regex(new RegExp(`^${ULID_PATTERN}$`));
export const IsoDateTime = z.iso.datetime();

export const IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ImageContentType = z.enum(IMAGE_CONTENT_TYPES);
export type ImageContentType = z.infer<typeof ImageContentType>;

/** File extension used in S3 keys for each allowed content type. */
export const IMAGE_EXTENSIONS: Record<ImageContentType, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const Confidence = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof Confidence>;

/** Raw upload key, written by the presigned POST and deleted by lifecycle after 1 day. */
export const ImageKeySchema = z.string().regex(new RegExp(`^tmp/${ULID_PATTERN}\\.(jpg|png|webp)$`));

/** Saved product photo key, served by CloudFront at `/<mediaKey>`. */
export const MediaKeySchema = z
  .string()
  .regex(new RegExp(`^media/products/${ULID_PATTERN}\\.(jpg|png|webp)$`));

/** Bedrock Converse accepts at most 3.75 MB per image (ADR 0007). */
export const MAX_UPLOAD_BYTES = 3_750_000;

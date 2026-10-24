import { describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORY_LABELS, ImageKeySchema, MediaKeySchema, Ulid } from "../src/schemas/common.js";

const ULID = "01JAZ3K9V2Q8W6X4Y7T5R1M0NP";

describe("[00 7] key formats", () => {
  it("[00 7.1] accepts a raw upload key", () => {
    expect(ImageKeySchema.safeParse(`tmp/${ULID}.jpg`).success).toBe(true);
    expect(ImageKeySchema.safeParse(`tmp/${ULID}.webp`).success).toBe(true);
  });

  it("[00 7.2] accepts a saved product photo key", () => {
    expect(MediaKeySchema.safeParse(`media/products/${ULID}.png`).success).toBe(true);
  });

  it.each([
    `tmp/../media/${ULID}.jpg`,
    `/tmp/${ULID}.jpg`,
    `uploads/${ULID}.jpg`,
    `tmp/${ULID.toLowerCase()}.jpg`,
    `tmp/${ULID}.gif`,
    `media/products/${ULID}.jpg`,
  ])("[00 7.3] rejects image key %s", (key) => {
    expect(ImageKeySchema.safeParse(key).success).toBe(false);
  });

  it.each([`tmp/${ULID}.jpg`, `media/products/../${ULID}.jpg`, `media/${ULID}.jpg`])(
    "[00 7.3] rejects media key %s",
    (key) => {
      expect(MediaKeySchema.safeParse(key).success).toBe(false);
    },
  );

  it("validates ULIDs", () => {
    expect(Ulid.safeParse(ULID).success).toBe(true);
    expect(Ulid.safeParse("01JAZ3K9V2Q8W6X4Y7T5R1M0NI").success).toBe(false);
  });
});

describe("[00 8.4] category labels", () => {
  it("has a Spanish label for every category", () => {
    for (const category of CATEGORIES) {
      expect(CATEGORY_LABELS[category]).toMatch(/^\p{Lu}/u);
    }
  });
});

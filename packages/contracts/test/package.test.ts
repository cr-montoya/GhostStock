import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  dependencies?: Record<string, string>;
  type?: string;
  sideEffects?: boolean;
};

describe("[00 11] package hygiene", () => {
  it("[00 11.1] depends only on zod 4 at runtime and on no workspace", () => {
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(["zod"]);
    expect(pkg.dependencies?.zod).toMatch(/^4\./);
  });

  it("[00 11.2] ships as tree-shakable ESM", () => {
    expect(pkg.type).toBe("module");
    expect(pkg.sideEffects).toBe(false);
  });
});

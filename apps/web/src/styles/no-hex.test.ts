// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("..", import.meta.url));
const ALLOWED = new Set(["styles/tokens.css"]);
const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi;

function sourceFiles(): string[] {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(tsx?|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
    .map((entry) => relative(SRC, join(entry.parentPath, entry.name)).replaceAll("\\", "/"));
}

describe("[02 1.1] design tokens", () => {
  it("keeps raw hex colors out of every file except styles/tokens.css", () => {
    const offenders = sourceFiles()
      .filter((file) => !ALLOWED.has(file))
      .flatMap((file) => {
        // Ignore URL-encoded fragments (%23) and in-page anchors like href="#contenido".
        const text = readFileSync(join(SRC, file), "utf8").replace(/href=["']#[\w-]+["']/g, "");
        return [...text.matchAll(HEX)].map((match) => `${file}: ${match[0]}`);
      });
    expect(offenders).toEqual([]);
  });

  it("defines every ui-identity token in tokens.css", () => {
    const tokens = readFileSync(join(SRC, "styles/tokens.css"), "utf8");
    for (const name of [
      "--bg", "--surface", "--surface-raised", "--border", "--text", "--muted",
      "--violet", "--violet-soft", "--ectoplasm", "--ember", "--blood", "--radius",
    ]) {
      expect(tokens).toMatch(new RegExp(`${name}:`));
    }
  });
});

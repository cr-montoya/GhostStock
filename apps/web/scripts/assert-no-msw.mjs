// Fails the build when anything from MSW reaches the production bundle (spec 02, 11.2).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
// Text markers only: keep build.sourcemap off or extend this check to .map files.
const markers = ["mockServiceWorker", "msw/browser", "setupWorker", "HttpResponse", "ghoststock:scenario"];
const leaks = [];

for (const entry of readdirSync(dist, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const path = join(entry.parentPath, entry.name);
  if (entry.name.startsWith("mockServiceWorker")) leaks.push(path);
  if (!/\.(js|html)$/.test(entry.name)) continue;
  const text = readFileSync(path, "utf8");
  for (const marker of markers) if (text.includes(marker)) leaks.push(`${path} (${marker})`);
}

if (leaks.length) {
  console.error(`MSW leaked into the production build:\n  ${leaks.join("\n  ")}`);
  process.exit(1);
}
console.log("dist is free of MSW");

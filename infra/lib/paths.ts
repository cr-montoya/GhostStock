import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const HANDLERS_DIR = join(REPO_ROOT, "services/api/src/handlers");
export const WEB_DIST_DIR = join(REPO_ROOT, "apps/web/dist");
export const LOCK_FILE = join(REPO_ROOT, "pnpm-lock.yaml");
export const API_TSCONFIG = join(REPO_ROOT, "services/api/tsconfig.json");
export const SPA_REWRITE_FILE = join(REPO_ROOT, "infra/lib/functions/spa-rewrite.js");

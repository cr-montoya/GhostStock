/** Spec scenarios plus test-only ones for save, list and mutation failures. */
export const SCENARIOS = [
  "happy",
  "empty",
  "zero-candidates",
  "model-error",
  "throttled",
  "network-error",
  "save-error",
  "products-error",
  "mutation-error",
] as const;
export type Scenario = (typeof SCENARIOS)[number];

const STORAGE_KEY = "ghoststock:scenario";

function isScenario(value: string | null): value is Scenario {
  return value !== null && (SCENARIOS as readonly string[]).includes(value);
}

/** Reads `?scenario=` once and keeps it in sessionStorage so navigation preserves it. */
export function currentScenario(): Scenario {
  const fromUrl = new URLSearchParams(window.location.search).get("scenario");
  if (isScenario(fromUrl)) {
    sessionStorage.setItem(STORAGE_KEY, fromUrl);
    return fromUrl;
  }
  const stored = sessionStorage.getItem(STORAGE_KEY);
  return isScenario(stored) ? stored : "happy";
}

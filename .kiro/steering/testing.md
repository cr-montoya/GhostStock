---
inclusion: fileMatch
fileMatchPattern: "**/*.{test,spec}.ts"
---

# Testing

Decision record: ADR 0009 (Playwright as the acceptance test framework).

## Two levels

| Level | Tool | Where | Proves |
| --- | --- | --- | --- |
| Acceptance | **Playwright Test** | `e2e/` workspace | EARS acceptance criteria, user flows, API contracts, deployed smoke, accessibility, visual |
| Unit | Vitest | next to the code, `*.test.ts` | pure functions, schemas, CDK template assertions |

Every EARS criterion maps to at least one Playwright test or a named unit test,
referenced in the test title: `test("[02-web 3.2] shows zero detections state", ...)`.

## Playwright projects (`e2e/playwright.config.ts`)

| Project | Target | Owner spec | Runs |
| --- | --- | --- | --- |
| `web-desktop`, `web-mobile` | Vite dev server with MSW (`webServer`), 1440x900 and Pixel 7 | 02 | local, pipeline pre step |
| `api` | `BASE_URL` (deployed CloudFront) | 01 | after deploy, manual or pipeline post step |
| `smoke` | `BASE_URL` | 03 | pipeline post step |
| `visual` | Vite + MSW, `toHaveScreenshot` | 02 | local only (OS dependent baselines) |

- MSW scenarios selected with the `?scenario=` query param (`happy`, `empty`,
  `zero-candidates`, `model-error`, `throttled`, `network-error`) so web tests are
  deterministic.
- Accessibility with `@axe-core/playwright` on every screen: no serious or critical
  violations.
- Reduced motion checked with `page.emulateMedia({ reducedMotion: "reduce" })`.
- API tests validate every response body with the zod schemas from
  `@ghoststock/contracts`.
- Tests that call Bedrock are tagged `@bedrock` and clean up what they create.
- Fixture images live in `e2e/fixtures/images/` (small, license-free, no people).

## Rules

- Locators by role and accessible name (`getByRole`, `getByLabel`), never CSS classes.
- No fixed sleeps; use web-first assertions.
- Unit tests mock AWS with `aws-sdk-client-mock`; no network in unit tests.
- A red test is fixed at its cause, never skipped to merge.

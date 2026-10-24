# Implementation Plan: 02-web

Branch: `feat/02-<slug>` per slice, worktree `../GhostStock-web`. Builder: `web-dev`.
Evaluators: `visual-qa`, `qa-engineer`, `code-reviewer`. Requires 00 merged.
Every UI slice ships with desktop and phone screenshots in its PR.

- [ ] 1. Scaffold web and Playwright workspaces
  - Vite React TS app, Tailwind 4, shadcn init, router, providers, MSW bootstrap.
  - `e2e/` workspace with `playwright.config.ts` (all five projects, `webServer` only
    when `BASE_URL` is unset), scripts `test:web`, `test:visual`, `test:api`,
    `test:smoke` and **no** `test` script (so root `pnpm test` never runs deployed
    projects), and one passing spec on the empty shell; add `e2e` to the root
    `workspaces` list.
  - Commit the fixture photos `e2e/fixtures/images/` (3 small license-free product
    photos and 1 photo with no products), used by web, api and smoke tests.
  - Commit carries `ADR-EXEMPT: workspaces recorded in ADR 0002 and ADR 0009`.
  - _Requirements: 11.1, 11.2_

- [ ] 2. Design system
  - `tokens.css`, `globals.css`, fonts, grain, glows, fog, shadcn theme mapping,
    `Logo`, `GhostEmptyState`, `ProductPhoto`, `copy/es.ts` skeleton.
  - Visual baseline of a token showcase route (dev only).
  - Vitest guard: no hex color literal under `apps/web/src` outside `tokens.css`.
  - _Requirements: 1.1, 1.2, 1.3, 10.2_

- [ ] 3. Shell and command palette
  - `AppShell`, `Sidebar`, `TabBar`, `CommandPalette`, 404 page.
  - Playwright: navigation on both viewports, Ctrl+K search.
  - _Requirements: 2.1, 2.2_

- [ ] 4. API client and mocks
  - `api/*`, query hooks, MSW handlers and scenarios from contract fixtures.
  - _Requirements: 11.1_

- [ ] 5. Ritual
  - `DropZone`, `CameraButton`, `resizeImage`, validation errors.
  - Playwright: invalid type, oversize, preview shown (`setInputFiles`).
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 6. Resurrection
  - `ResurrectionStage`, `ScanLine`, `Fog`, `StatusTicker`, failure and zero states.
  - Playwright: status region announces, `model-error`, `throttled`,
    `network-error`, `zero-candidates` scenarios with retry.
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 7. Review and save
  - `CandidateCard`, `ConfidenceChip`, `useReview`, save mutation, toast, navigation.
  - Playwright: no prefilled price or quantity, save disabled until valid, discard
    and restore, success navigates to `/` with toast, failure keeps edits.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3_

- [ ] 8. Dashboard
  - KPI cards with count-up, charts, low-stock list, recent grid, empty state.
  - Playwright: KPI values equal `computeInventoryStats(productsFixture)`; `empty`
    scenario shows the ghost and CTA.
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 9. Inventory
  - Table and cards, filters, drawer edit with optimistic update, delete dialog, CSV.
  - Playwright: search and chips, edit, delete, CSV download content checked with
    `productsToCsv`.
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 10. Settings
  - `ThresholdForm`; dashboard and inventory react to the saved threshold.
  - _Requirements: 9.1_

- [ ] 11. Accessibility, motion and visual pass
  - `a11y.spec.ts` (axe on every screen), `motion.spec.ts` (reduced motion), keyboard
    path, `visual` baselines for every screen and state; run `visual-qa`.
  - _Requirements: 10.1, 10.3, 10.4, 11.3, 11.4_

- [ ] 12. Verify and sync
  - `pnpm --filter @ghoststock/web build` (no MSW in bundle), web e2e green on both
    viewports, `spec-sync`, `docs/demo.md` first draft.
  - _Requirements: 11.2, 11.3_

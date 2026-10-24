---
name: visual-qa
description: >
  Visual and UX review of the running web app against .kiro/steering/ui-identity.md:
  screenshots on desktop and phone, every state of every screen, motion, contrast,
  Spanish copy. Use after any apps/web change, before /pr, or with /visual-qa.
---

# Visual QA

The UI is a judging criterion. "Works" is not enough: it must look premium.

## Steps
1. Capture with Playwright: `npx playwright test -c e2e --project=visual`
   (starts Vite with MSW). Update baselines only on purpose with
   `--update-snapshots` and review the diff images.
2. Every screen at 1440x900 and Pixel 7: Almacén, Invocar (ritual, resurrection,
   review), Inventario (table and cards), edit drawer, Ajustes, using the `?scenario=`
   switch for each state. For live inspection, also open the dev server in a browser.
3. Force every state: empty, loading/skeleton, zero detections, model error, network
   error, low stock, long names, 50+ products.
4. Score against `ui-identity.md`:
   - Tokens only (no stray hex), typography scale, spacing rhythm, alignment.
   - Signature moments present and smooth (ritual, resurrection scan, rising cards,
     KPI count-up); nothing janky; `prefers-reduced-motion` honored.
   - AA contrast, visible focus, keyboard path through upload -> review -> save.
   - Copy in natural Spanish, consistent tone, no English leaks.
   - Halloween personality without clutter or childish elements.
5. Fix or file each finding, re-capture, compare before/after.

## Output
```
VISUAL QA: <screen or PR>
SCORE: polish x/5, identity x/5, a11y x/5, mobile x/5
BLOCKERS / POLISH: <screen, what, fix>
SCREENSHOTS: <paths, outside the repo unless they go into the PR>
```

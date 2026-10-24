# ADR 0009: Playwright for acceptance tests, Vitest for units

- **Status:** accepted
- **Date:** 2026-10-24
- **Spec:** all

## Context

Every EARS criterion must be proven against real behavior: browser flows on desktop
and phone, the deployed API, security headers, accessibility and the visual identity.
Unit-level checks (schemas, pure services, CDK templates) need speed and no browser.

## Options considered

1. **Playwright Test for all acceptance testing, Vitest for unit tests**.
2. **Vitest plus Testing Library only**: rejected, no real browser, no deployed
   checks, no visual baselines.
3. **Cypress**: rejected, weaker multi-viewport, API and parallel story, and a second
   runner for deployed checks.

## Decision

A dedicated `e2e/` workspace with `@playwright/test` and `@axe-core/playwright`.
Projects: `web-desktop` and `web-mobile` (Vite with MSW scenarios), `visual`
(screenshot baselines, local only), `api` and `smoke` (deployed `BASE_URL`). Test
titles carry the spec criterion id. Vitest remains for unit tests in each workspace.
The pipeline runs `web-desktop` before deploy and `smoke` after deploy when
`enableTests` is on.

## Consequences

- **Positive:** one framework proves UI, API and deployment; screenshots double as PR
  evidence and visual QA.
- **Negative:** browser install in CodeBuild adds about a minute; visual baselines are
  OS dependent, so they stay local.
- **Follow-up:** run visual baselines in the official Playwright Docker image if they
  should gate CI.

## Well-Architected notes

Operational excellence and reliability: automated verification before and after each
deploy.

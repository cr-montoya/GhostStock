<!--
Small, vertical PR into main (trunk-based). Tick every box or write n/a:
an unticked box reads as "not done". No AI attribution lines anywhere.
-->

## What and why

<!-- One short paragraph: what changes and the motivation. The why, not the diff. -->

**Lane:** <!-- contracts | api | web | infra | pipeline | docs | harness -->
**Spec:** `.kiro/specs/<NN>-<slug>/` · tasks: <!-- e.g. 2.1, 2.2 -->
**ADR:** <!-- docs/adr/NNNN-<slug>.md, or n/a -->

## Scope

-

## Out of scope

<!-- What we deliberately did not touch to keep this PR small. -->
-

## Acceptance criteria

<!-- EARS criteria from requirements.md that this PR satisfies. -->
- [ ] AC -

## Evidence

<!-- Real output, trimmed. Screenshots or a short clip for any UI change
     (desktop 1440 and phone 390). Never paste secrets or presigned URLs. -->
- [ ] `npm test` green (affected workspaces, Vitest units)
- [ ] Playwright green: `npx playwright test -c e2e --project=<web-desktop|web-mobile|api|smoke>`
- [ ] `npm run lint` and `npm run typecheck` clean
- [ ] `npx cdk synth` OK (if `infra/**` changed) · `cdk diff` summary below
- [ ] Manually verified:

```text
```

| Desktop | Phone |
| --- | --- |
|  |  |

## Gates

- [ ] `grill` pre-PR re-check, no spec drift
- [ ] `qa-engineer`: every AC mapped to evidence
- [ ] `code-reviewer`: no Blockers
- [ ] `security-reviewer`: no Critical/High (required for infra, IAM, uploads, Bedrock)
- [ ] `visual-qa`: screens and states reviewed (required for `apps/web/**`)

## Living docs

- [ ] `tasks.md` ticked and `design.md` matches what was built (`spec-sync`)
- [ ] `docs/` updated where this change makes them stale
- [ ] ADR added or superseded for any architecture decision

## Trunk-based checklist

- [ ] Short-lived branch `<type>/<NN>-<slug>` from current `main`
- [ ] Atomic Conventional Commits, no attribution trailers
- [ ] `main` stays deployable after merge; rollback: <!-- revert this PR / flag -->
- [ ] Merge with **Rebase and merge**, delete the branch

## Notes for the reviewer

<!-- Trade-offs, what to look at closely, known debt. -->

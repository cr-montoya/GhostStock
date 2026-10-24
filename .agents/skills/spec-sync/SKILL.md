---
name: spec-sync
description: >
  Keep the Kiro spec and the living docs current with reality: tick tasks.md, reconcile
  design.md with what was built, update docs/ and ADRs. Use at every checkpoint, before
  /pr, when implementation diverges from the spec, or with /spec-sync.
---

# Spec sync (zero drift, living docs)

The spec and `docs/` describe the system as it is on `main`. If they lie, the change
is not done.

## Steps
1. Identify the spec from the branch (`feat/02-...` -> `.kiro/specs/02-*/`).
2. Diff reality vs contract: `git diff main...HEAD` against `design.md` and the
   contracts. List every divergence.
3. For each divergence decide: the code is wrong (fix the code) or the spec is outdated
   (update `design.md` / `requirements.md` and say why in the commit).
   A divergence that is an architecture decision gets an ADR.
4. Tick completed items in `tasks.md`; add discovered tasks instead of doing them
   silently.
5. Update the living docs touched by the change (see `docs/README.md` ownership table):
   architecture, API reference examples, deployment runbook, demo script.
6. Commit as `docs(spec): ...` / `docs(<area>): ...`, separate from code commits.

## Output
```
SPEC SYNC: <spec>
TICKED: <task ids>
SPEC UPDATED: <file: what and why>
DOCS UPDATED: <files>
ADRS: <new/superseded or none>
OPEN DRIFT: <none or list>
```

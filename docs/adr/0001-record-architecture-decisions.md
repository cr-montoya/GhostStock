# ADR 0001: Record architecture decisions as living ADRs in the repo

- **Status:** accepted
- **Date:** 2026-10-24
- **Spec:** n/a

## Context

GhostStock is built in one day by one person directing several AI agents in parallel
worktrees. Kiro specs say what we build; nothing records why a path was chosen over
another. Without that, parallel agents re-open settled decisions and reviewers (and
judges) cannot follow the reasoning.

## Options considered

1. **Numbered ADRs in `docs/adr/`, enforced by a git gate**: durable, reviewable in PRs.
2. **Decisions only inside each spec's `design.md`**: rejected because decisions cross
   specs and get lost when a design is rewritten.
3. **No formal record**: rejected, it is the main source of drift between agents.

## Decision

Every architecture decision gets a short numbered ADR in `docs/adr/` from
`template.md`, indexed in `docs/adr/README.md`, linked from the spec's `design.md` and
the PR. ADRs are superseded, never rewritten. The `commit-msg` git hook blocks commits
with architecture signals (new workspace, new CDK stack, `infra/cdk.json`, new runtime
dependency in api or infra) unless an ADR ships in the same commit or the message
carries an `ADR-EXEMPT: <reason>` waiver.

## Consequences

- **Positive:** the why survives; agents read decisions instead of re-deciding.
- **Negative:** small overhead per decision; the gate can produce false positives.
- **Follow-up:** the waiver keeps false positives cheap and visible in history.

## Well-Architected notes

Operational excellence: decisions are documented and reviewable.

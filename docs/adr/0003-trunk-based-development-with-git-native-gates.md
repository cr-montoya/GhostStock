# ADR 0003: Trunk-based development with git-native gates

- **Status:** accepted
- **Date:** 2026-10-24
- **Spec:** n/a

## Context

Several AI tools commit to this repo (Kiro, Claude Code, others) plus the owner by
hand. The history must be many small, readable commits on a deployable `main`, and
the rules must hold no matter which tool commits. Tool-specific hooks only bind one
tool.

## Options considered

1. **Git hooks versioned in `.agents/hooks/git` (`core.hooksPath`) + GitHub branch
   protection**: every committer is gated, the server enforces PRs.
2. **Per-tool hooks (Kiro hooks, Claude Code hooks)**: rejected as the enforcement
   layer because each binds a single tool. They remain useful for feedback.
3. **CI-only checks**: rejected, feedback arrives after the push.

## Decision

`main` is the trunk and always deployable (the pipeline deploys it). Work happens on
short-lived `<type>/<NN>-<slug>` branches merged by PR with "Rebase and merge" so atomic
commits are preserved. Git hooks in `.agents/hooks/git` enforce: no commits on `main`,
no push to `main`, a cheap secret scan, Conventional Commits headers, removal of AI
attribution trailers, and the ADR gate (ADR 0001). GitHub branch protection on `main`
requires a PR.

## Consequences

- **Positive:** same rules for every tool and for humans; clean, judge-readable history.
- **Negative:** each clone must run `git config core.hooksPath .agents/hooks/git` once
  (automated later by the root `prepare` script); hooks need Node.js.
- **Follow-up:** add the `prepare` script when the root `package.json` lands.

## Well-Architected notes

Operational excellence: small reversible changes, enforced at the source.

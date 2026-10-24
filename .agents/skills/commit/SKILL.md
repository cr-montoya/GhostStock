---
name: commit
description: >
  Write a Conventional Commits message for the staged change and commit it. Use when
  asked to commit, "commitea", or /commit. Never adds AI attribution.
---

# Commit (Conventional Commits 1.0.0)

## Format
```
<type>(<scope>): <description>

[optional body: the why, wrapped at 72]
```
- **type**: `feat` | `fix` | `docs` | `style` | `refactor` | `perf` | `test` | `build` |
  `ci` | `chore` | `revert`. Breaking change: `!` after type/scope.
- **scope**: `web` | `api` | `contracts` | `infra` | `pipeline` | `spec` | `adr` |
  `docs` | `harness` | `repo`.
- **description**: English, imperative, lowercase, no trailing period, <= 72 chars.

## No attribution, ever
No `Co-Authored-By`, no "Generated with", no tool or model names in the message. The
human who owns the change is the author. The `commit-msg` git hook strips any
attribution that slips in, but do not rely on it: never write it.

## Steps
1. `git status` + `git diff --cached`. If nothing is staged, stage only the files of
   one logical change; never `git add -A` blindly.
2. Never commit on `main` (the `pre-commit` gate blocks it). Work on
   `<type>/<spec>-<slug>`.
3. Pick type and scope from the actual diff. Mixed concerns -> split into several
   commits. Many small commits are the goal (trunk-based, judged history).
4. Architecture signal (new workspace, new CDK stack, `infra/cdk.json`, new runtime
   dependency in api/infra) -> the ADR goes in the same commit (`adr` skill).
5. Commit with `-m` (or `-F` for a body). Report the resulting `git log --oneline -1`.

## Examples
```
feat(contracts): add product candidate zod schema
fix(api): map bedrock throttling to 503 retryable error
feat(infra): add cloudfront distribution with oac origins
docs(adr): record single cloudfront origin for web, api and media
```

---
name: pr
description: >
  Open the current branch's pull request into main using the repo template, linked to
  its Kiro spec, after the pre-PR gates. Use when work is review-ready, or /pr.
---

# Pull request into `main`

## Steps
1. **Context.** `git branch --show-current`, `git log --oneline main..HEAD`,
   `git diff main...HEAD --stat`. The spec comes from the branch name
   (`feat/01-...` -> `.kiro/specs/01-*/`).
2. **Pre-PR gates.** Run `grill` (spec-drift section), then the evaluators in
   parallel on the real diff: `qa-engineer`, `code-reviewer`, `security-reviewer`
   (required for `infra/**`, IAM, uploads, Bedrock), and `visual-qa` for `apps/web/**`.
   Blockers are fixed and the gate re-run before opening.
3. **Living docs.** Confirm `tasks.md` is ticked, `docs/` reflects the change and any
   decision has its ADR (`spec-sync`). Doc drift is a blocker.
4. **Title** in Conventional Commit style, e.g. `feat(api): analyze image with bedrock converse`.
5. **Body** from [.github/pull_request_template.md](../../../.github/pull_request_template.md),
   every box ticked or `n/a`. Write it to a temp file outside the repo. Screenshots for
   any UI change. No attribution lines.
6. **Open** (push the branch first, never `main`):
   ```sh
   git push -u origin "$(git branch --show-current)"
   gh pr create --base main --title "<title>" --body-file "$TMP/pr-body.md"
   ```
7. **Merge** with "Rebase and merge" so every atomic commit lands on `main`, then
   delete the branch. Only after the owner approves.

## Rules
- Small vertical PRs, one spec slice each, short-lived branches (hours, not days).
- Approvals from before a fix are stale: re-run the affected gate.
- Never push to `main` or force-push a shared branch.

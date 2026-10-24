# AGENTS.md: GhostStock

> **Router for every AI tool** (Kiro, Claude Code, Codex, others). Read this first, then
> follow the links. Facts live in one place and are linked, never copied
> ([ADR 0004](docs/adr/0004-kiro-owns-what-agents-owns-how.md)). There is no
> `CLAUDE.md` or other tool-specific instruction file by design.

**GhostStock: Bring Your Inventory Back From the Dead.** Photograph physical products,
Amazon Bedrock proposes structured product candidates, the user reviews and saves them,
and gets a searchable inventory dashboard with stats and CSV export. App UI in Spanish;
code, specs, docs and commits in English. Built for Kiro Day Medellin 2026.

**North star:** upload photo -> analyze with Bedrock -> review -> save -> dashboard.
Everything else is secondary.

---

## Where things live

| What | Where | Owner |
| --- | --- | --- |
| Product knowledge (vision, architecture, UI identity, security, AI rules) | [.kiro/steering/](.kiro/steering/) | Kiro |
| Contracts per feature (requirements EARS, design, tasks) | [.kiro/specs/](.kiro/specs/) | Kiro |
| Working method: skills, agent briefs, git gates | [.agents/](.agents/) | harness |
| Living docs and ADRs | [docs/](docs/README.md), [docs/adr/](docs/adr/README.md) | every PR |
| PR template | [.github/pull_request_template.md](.github/pull_request_template.md) | harness |

Monorepo ([ADR 0002](docs/adr/0002-typescript-only-monorepo-including-cdk.md)), all TypeScript:
```
apps/web/            React + Vite + Tailwind + shadcn/ui + Motion     (spec 02-web)
services/api/        Lambda handlers, Bedrock, DynamoDB, S3           (spec 01-api-bedrock)
packages/contracts/  zod schemas + types + fixtures, shared by all    (spec 00-contracts)
infra/               AWS CDK v2 + self-mutating CDK Pipeline         (spec 03-infra-pipeline)
e2e/                 Playwright acceptance tests: web/ api/ smoke/ visual/ (ADR 0009)
```

Tests: **Playwright** proves every acceptance criterion (UI flows on desktop and
phone, deployed API, smoke, accessibility, visual); Vitest covers pure units. Rules in
[.kiro/steering/testing.md](.kiro/steering/testing.md).

## How we work

1. **Spec-Driven Development** ([docs/sdd-workflow.md](docs/sdd-workflow.md)). Kiro
   writes the spec; `grill` gates it; a builder implements it in its own worktree;
   independent evaluators review; `spec-sync` keeps spec and docs true.
2. **Trunk-based** ([docs/git-workflow.md](docs/git-workflow.md)). `main` is always
   deployable. Short-lived `<type>/<NN>-<slug>` branches, atomic Conventional Commits,
   PRs merged with "Rebase and merge".
3. **Decisions are recorded** ([docs/adr/](docs/adr/README.md)). Architecture changes
   ship with their ADR in the same commit.
4. **Docs are living.** A PR that makes a doc lie is not done.

## Hard rules

1. **Spec first.** No code in `apps/`, `services/`, `packages/`, `infra/` without a spec
   in `.kiro/specs/`. If reality diverges, update the spec before the code.
2. **Never commit or push to `main`.** Never force-push a shared branch. Never
   `--no-verify`.
3. **No AI attribution** in commits or PRs: no `Co-Authored-By`, no "Generated with".
4. **Contracts only through `packages/contracts`.** No locally redefined API shapes.
5. **No secrets** in the repo, logs, tests or the frontend bundle. Never read `.env*`.
6. **No `cdk deploy` / `cdk destroy`** against an account without the owner's explicit
   go-ahead in the session. `cdk synth` and `cdk diff` are always fine.
7. **Never fabricate AI results.** Invalid or empty model output is an explicit state.
8. **Minimum necessary change.** No unrequested refactors.
9. **pnpm only** ([ADR 0011](docs/adr/0011-pnpm-workspaces.md)). Never run `npm`, `npx`
   or `yarn`: use `pnpm install`, `pnpm --filter <pkg> <script>`, `pnpm exec <bin>`,
   `pnpm dlx <pkg>`. Internal dependencies use `workspace:*`.

## Agents

Briefs in [.agents/agents/](.agents/agents/). The main session orchestrates: it
decomposes, delegates and runs evaluators; it never builds and reviews the same work.

| Agent | Role | Owns |
| --- | --- | --- |
| `web-dev` | builder | `apps/web/**`, `e2e/web/**`, `e2e/visual/**`, `e2e/fixtures/**`, Playwright scaffold, `docs/demo.md` |
| `api-dev` | builder | `services/api/**`, `e2e/api/**` |
| `infra-dev` | builder | `infra/**`, `e2e/smoke/**`, `docs/deployment.md`, `docs/architecture.md` |
| `qa-engineer` | evaluator (writes tests only) | AC -> Playwright evidence |
| `code-reviewer` | evaluator, read-only | diff review |
| `security-reviewer` | evaluator, read-only | Critical/High block merge |

`packages/contracts/**` and `docs/api.md` are owned by spec `00-contracts` and change
only there.

## Skills

Bodies in [.agents/skills/](.agents/skills/). Tools that do not auto-discover them:
read `.agents/skills/<name>/SKILL.md` and follow it.

| Skill | Use |
| --- | --- |
| `grill` | Stress-test a spec before building and before the PR (hard verdict) |
| `spec-sync` | Tick tasks, reconcile design, update docs and ADRs |
| `adr` | Record or supersede an architecture decision |
| `commit` | Conventional Commit, no attribution |
| `pr` | PR into `main` from the template, after the gates |
| `visual-qa` | Screens, states, motion, a11y vs the UI identity |

## Gate matrix

| Change | Builder -> mandatory evaluators |
| --- | --- |
| `packages/contracts/**` | owner of spec 00 -> `code-reviewer`, `grill` on 01/02/03 impact |
| `services/api/**` | `api-dev` -> `qa-engineer`, `code-reviewer`, `security-reviewer` |
| `apps/web/**` | `web-dev` -> `visual-qa`, `qa-engineer`, `code-reviewer` |
| `infra/**` | `infra-dev` -> `code-reviewer`, `security-reviewer` |
| Specs, docs, harness | `grill` or `code-reviewer` on the text |

Loops: generate -> evaluate -> fix, at most 3 rounds, then stop and escalate with
evidence. Approvals from before a fix are stale.

## Git gates

Versioned in `.agents/hooks/git` and run for every tool and human
([ADR 0003](docs/adr/0003-trunk-based-development-with-git-native-gates.md)). Enable once
per clone or worktree checkout:
```sh
git config core.hooksPath .agents/hooks/git
```

## Session hygiene

- One spec per session and per worktree. Start by reading this file, the spec's
  `requirements.md`, then only the design/tasks sections you need.
- Search before reading; pipe long test output through a failures-only filter.
- Replies short: outcome first, evidence next, no recap of the diff.

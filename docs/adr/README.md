# Architecture Decision Records

One file per decision, `NNNN-<kebab-slug>.md`, from [template.md](template.md), created
with the [`adr` skill](../../.agents/skills/adr/SKILL.md). Superseded, never rewritten.
The `commit-msg` gate enforces ADRs for architecture-signal commits (see 0001).

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions as living ADRs, enforced by a git gate | accepted |
| [0002](0002-typescript-only-monorepo-including-cdk.md) | TypeScript-only monorepo, CDK included | accepted, amended by 0011 |
| [0003](0003-trunk-based-development-with-git-native-gates.md) | Trunk-based development on `main` with git-native gates | accepted |
| [0004](0004-kiro-owns-what-agents-owns-how.md) | Kiro owns the what, `.agents/` owns the how, `AGENTS.md` routes | accepted |
| [0005](0005-single-table-and-client-side-aggregates.md) | Single-table DynamoDB, stats and CSV computed in the browser | accepted |
| [0006](0006-single-cloudfront-origin.md) | One CloudFront origin for web, `/api/*` and `/media/*` | accepted |
| [0007](0007-bedrock-structured-output-and-honest-ai.md) | Forced tool use with a schema that cannot hold prices, quantities or SKUs | accepted |
| [0008](0008-one-app-stack-and-self-mutating-pipeline.md) | One AppStack plus a self-mutating pipeline with persisted deploy-time context | accepted, amended by 0011 |
| [0009](0009-playwright-acceptance-tests.md) | Playwright for acceptance tests, Vitest for units | accepted |
| [0010](0010-api-runtime-dependencies.md) | API runtime dependencies | accepted |
| [0011](0011-pnpm-workspaces.md) | pnpm is the only package manager (workspaces, corepack, `workspace:*`) | accepted |
| [0012](0012-default-model-amazon-nova-pro.md) | Default Bedrock model is Amazon Nova Pro (no Anthropic form needed) | accepted |
| [0013](0013-manual-teardown-keeps-the-pipeline.md) | Manual teardown project that deletes the app and keeps the pipeline | superseded by 0014 |
| [0014](0014-manual-teardown-stage-after-prod.md) | Manual approval teardown stage after Prod that deletes the app and keeps the pipeline | accepted |

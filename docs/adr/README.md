# Architecture Decision Records

One file per decision, `NNNN-<kebab-slug>.md`, from [template.md](template.md), created
with the [`adr` skill](../../.agents/skills/adr/SKILL.md). Superseded, never rewritten.
The `commit-msg` gate enforces ADRs for architecture-signal commits (see 0001).

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions as living ADRs, enforced by a git gate | accepted |
| [0002](0002-typescript-only-monorepo-including-cdk.md) | TypeScript-only npm-workspaces monorepo, CDK included | accepted |
| [0003](0003-trunk-based-development-with-git-native-gates.md) | Trunk-based development on `main` with git-native gates | accepted |
| [0004](0004-kiro-owns-what-agents-owns-how.md) | Kiro owns the what, `.agents/` owns the how, `AGENTS.md` routes | accepted |

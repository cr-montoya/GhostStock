# ADR 0011: pnpm is the only package manager

- **Status:** accepted
- **Date:** 2026-10-24
- **Spec:** all
- **Amends:** 0002 (npm workspaces), 0008 (pipeline commands)

## Context

ADR 0002 chose npm workspaces. The owner requires pnpm for every install, script and
pipeline step. Several agents work in parallel worktrees, so installs must be fast,
deterministic and strict about undeclared dependencies.

## Options considered

1. **pnpm workspaces, pinned through `packageManager` and corepack**: strict
   `node_modules`, content-addressed store shared across worktrees, one lockfile.
2. **Keep npm workspaces**: rejected by the owner.

## Decision

- Workspaces are declared in `pnpm-workspace.yaml`; the root `packageManager` pins
  pnpm 11.8.0; the lockfile is `pnpm-lock.yaml`.
- Internal dependencies use `"@ghoststock/contracts": "workspace:*"`.
- Commands: `pnpm install --frozen-lockfile`, `pnpm build` and `pnpm test`
  (recursive, topological), `pnpm --filter <pkg> <script>`, `pnpm exec <bin>`.
- CodeBuild steps start with `corepack enable` (bundled with Node.js 22); npm is never
  invoked. A root `preinstall` guard fails any install not run by pnpm.
- `NodejsFunction` uses `pnpm-lock.yaml` as `depsLockFilePath`.
- Dependencies with install scripts (for example esbuild) are allowed explicitly in
  `pnpm-workspace.yaml` when they are first added.

## Consequences

- **Positive:** faster parallel installs, no phantom dependencies, one tool everywhere.
- **Negative:** corepack must be enabled on every machine and CodeBuild step.
- **Follow-up:** none.

## Well-Architected notes

Operational excellence and security: deterministic installs, strict dependency graph.

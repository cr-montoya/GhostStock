# GhostStock docs

Living documentation: it describes the system as it is on `main`. A PR that makes a
doc lie is not done (`spec-sync` skill, PR template "Living docs" section).

| Doc | What it answers | Owner lane | Status |
| --- | --- | --- | --- |
| [adr/](adr/README.md) | Why we chose each path | any | live |
| [git-workflow.md](git-workflow.md) | Branches, commits, PRs, gates | harness | live |
| [sdd-workflow.md](sdd-workflow.md) | Kiro spec to merged code | harness | live |
| architecture.md | Components, data flow, AWS services, diagrams | infra | from spec 03 |
| [api.md](api.md) | Endpoints with example requests and responses (generated from fixtures) | contracts | live |
| deployment.md | Bootstrap, CodeConnections, first deploy, pipeline | infra | from spec 03 |
| kiro-usage.md | Which Kiro features we use, why, how to demo them | harness | from Kiro step 3 |
| demo.md | The 3-minute demo script and checklist | web | before the demo |

Rules:
- Update the doc in the same PR as the change that affects it.
- Examples are copied from `packages/contracts` fixtures, not handwritten.
- Diagrams as Mermaid in Markdown so they diff and render on GitHub.

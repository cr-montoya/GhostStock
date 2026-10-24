<div align="center">

# GhostStock

**Bring Your Inventory Back From the Dead.**

Take a photo of your shelf. Amazon Bedrock recognizes the products. You confirm quantities and prices. Your warehouse wakes up.

![AWS](https://img.shields.io/badge/AWS-CDK%20v2-232F3E?style=flat-square&logo=amazonwebservices&logoColor=white)
![Bedrock](https://img.shields.io/badge/Amazon-Bedrock-01A88D?style=flat-square&logo=amazonwebservices&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![pnpm](https://img.shields.io/badge/pnpm-workspaces-F69220?style=flat-square&logo=pnpm&logoColor=white)
![Playwright](https://img.shields.io/badge/tested%20with-Playwright-2EAD33?style=flat-square&logo=playwright&logoColor=white)
![Kiro](https://img.shields.io/badge/specs%20by-Kiro-7C3AED?style=flat-square)

Built in one day at **Kiro Day Medellín 2026**.

</div>

---

## What it does

| Step | What happens |
| --- | --- |
| **The ritual** | Drop or take a photo. The browser downscales it and uploads it straight to S3 with a presigned POST. |
| **The resurrection** | A Lambda sends the image to Amazon Bedrock (Converse API) with one forced tool, `report_products`. |
| **The review** | Candidates rise as editable cards with a confidence level and notes. You add quantity, unit price and an optional SKU. |
| **The awakening** | Products are saved; the dashboard counts up value, units, categories and low stock. |
| **The inventory** | Search, filter by category, edit, delete and export to CSV ready for Excel. |

### Honest AI by design

The model can only answer by filling a strict schema that has **no fields for price, quantity, SKU or barcode**, so it cannot invent them. Every number in the inventory is typed by a person. Zero detections is a valid answer shown as a state, invalid output is rejected whole, and nothing is ever fabricated ([ADR 0007](docs/adr/0007-bedrock-structured-output-and-honest-ai.md)).

## Architecture

![GhostStock architecture on AWS](docs/diagrams/architecture.png)

- **One public entry point.** A single CloudFront distribution serves the SPA, `/api/*` and `/media/*`. Both buckets are private behind OAC, so the API needs no CORS ([ADR 0006](docs/adr/0006-single-cloudfront-origin.md)).
- **Serverless and minimal.** HTTP API, three Lambda functions on Node.js 22 arm64, one DynamoDB table and Amazon Bedrock. No queues, containers or servers ([ADR 0005](docs/adr/0005-single-table-and-client-side-aggregates.md)).
- **Least privilege.** One IAM role per function with exact actions and resources, cdk-nag `AwsSolutions` with zero open findings, throttling and a cost budget.
- **Self-mutating delivery.** Every merge to `main` runs a CDK Pipeline that builds, updates itself and deploys; Playwright gates run before and after the deploy ([ADR 0008](docs/adr/0008-one-app-stack-and-self-mutating-pipeline.md)).

Editable source: [`docs/diagrams/architecture.drawio`](docs/diagrams/architecture.drawio). Service by service details: [docs/architecture.md](docs/architecture.md).

## How it was built

GhostStock is as much about **how** it was built as about what it does.

**Spec-Driven Development with Kiro.** Kiro wrote the steering and four specs ([`.kiro/specs`](.kiro/specs)) with EARS requirements, design and tasks. Steering loads by context: the web agent gets the visual identity, the infra agent gets the CDK rules ([`.kiro/steering`](.kiro/steering)).

**Adversarial review before code.** Every spec went through a *grill*: an agent whose only job is to break it. The first verdict was DO NOT START because the model could still invent prices. The spec was fixed, an independent reviewer found five more blockers, and only then was code written.

**A harness every tool obeys.**
- [`AGENTS.md`](AGENTS.md) is the single router for Kiro, Claude Code or any other agent; skills and agent briefs live once in [`.agents/`](.agents).
- Git-native gates in [`.agents/hooks/git`](.agents/hooks/git): no commits or pushes to `main`, Conventional Commits, no AI attribution, secret scan, and an ADR gate for architecture changes.
- Twelve [ADRs](docs/adr/README.md) and living docs; [`docs/api.md`](docs/api.md) is generated from the contract fixtures.

**Parallel agents, independent evaluators.** Three agents worked in parallel lanes (API, web, infra), each in its own git worktree with path ownership and no overlaps. No builder certified its own work: code, security, QA and visual reviewers ran on every pull request. More than 25 small PRs landed on a trunk-based `main`.

## Stack

| Layer | Technology |
| --- | --- |
| Contracts | zod 4 schemas, types and fixtures shared by every workspace |
| Web | React 19, Vite, Tailwind CSS 4, shadcn/ui, Motion, TanStack Query, MSW |
| API | AWS Lambda (TypeScript), AWS SDK v3, Powertools for AWS Lambda |
| AI | Amazon Bedrock Converse with forced tool use (Amazon Nova Pro, Claude ready) |
| Data | DynamoDB single table, S3 |
| Infra | AWS CDK v2 in TypeScript, CDK Pipelines, CloudFront, cdk-nag |
| Tests | Playwright (web, API, smoke, accessibility, visual) and Vitest |
| Tooling | pnpm workspaces, Kiro, Claude Code |

## Repository layout

```
packages/contracts/   zod schemas, fixtures, stats and CSV helpers (spec 00)
services/api/         Lambda handlers, Bedrock adapter, DynamoDB and S3 (spec 01)
apps/web/             React SPA with the Halloween identity (spec 02)
infra/                CDK app stack and self-mutating pipeline (spec 03)
e2e/                  Playwright projects: web, visual, api, smoke
.kiro/                steering and specs
.agents/              skills, agent briefs and git gates
docs/                 architecture, deployment, API reference, ADRs, demo script
```

## Run it locally

Requires Node.js 22 and pnpm (enabled with `corepack enable`). npm is blocked on purpose ([ADR 0011](docs/adr/0011-pnpm-workspaces.md)).

```sh
pnpm install
pnpm build
pnpm --filter @ghoststock/web dev
```

The web app runs on `http://localhost:5173` with mocked APIs (MSW). Add `?scenario=zero-candidates`, `model-error`, `throttled` or `empty` to the URL to see every state.

```sh
pnpm test                                   # unit tests in every workspace
pnpm --filter @ghoststock/e2e test:web      # Playwright on desktop and phone
```

## Deploy

One manual deploy creates the pipeline; after that every merge to `main` ships itself. Bootstrap, the CodeConnections authorization, Bedrock model access and the first `cdk deploy` are documented step by step in [docs/deployment.md](docs/deployment.md).

## Documentation

| Doc | What it answers |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | AWS services, responsibilities and known limits |
| [docs/deployment.md](docs/deployment.md) | First deployment and pipeline operation |
| [docs/api.md](docs/api.md) | Every endpoint with example payloads |
| [docs/adr/](docs/adr/README.md) | Why each decision was made |
| [docs/sdd-workflow.md](docs/sdd-workflow.md) | From Kiro spec to merged code |
| [docs/git-workflow.md](docs/git-workflow.md) | Trunk-based flow and git gates |
| [docs/demo.md](docs/demo.md) | The 3 minute demo script |

---

<div align="center">

Made with specs, a strict harness and a little ectoplasm by [Cristian Montoya](https://github.com/cr-montoya).

</div>

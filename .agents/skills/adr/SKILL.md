---
name: adr
description: >
  Create or supersede an Architecture Decision Record in docs/adr/. Use when a change
  introduces or revises an architecture decision (service choice, data model, contract
  shape, pipeline topology, new runtime dependency), when the adr-gate blocks a commit,
  or with /adr.
---

# ADR (Architecture Decision Record)

ADRs keep the **why** durable. Specs say what we build; ADRs say why we chose this
path over the alternatives. They are living docs: superseded, never edited away.

## When
- New AWS service, CDK stack or construct pattern; CloudFront routing; IAM model.
- Data model or access pattern change in DynamoDB.
- Contract shape change in `packages/contracts` that breaks a consumer.
- Bedrock model, prompt strategy or structured-output mechanism.
- Pipeline topology, stages, `cdk.json` flags.
- New workspace package or runtime dependency in `services/api` or `infra`.
The `commit-msg` gate enforces the last three mechanically.

## Steps
1. Read `docs/adr/README.md` to avoid duplicates; take the next number.
2. Write `docs/adr/NNNN-<kebab-slug>.md` from [template.md](../../../docs/adr/template.md).
3. Add one line to the index in `docs/adr/README.md`.
4. Link it from the spec's `design.md` and from the PR body.
5. Revising a decision: new ADR, old one gets `Status: superseded by NNNN`.
6. Commit the ADR together with the change it justifies: `docs(adr): ...` or inside
   the feature commit.

## Quality bar
- Context names the forces and at least one rejected alternative with the reason.
- Decision is one plain paragraph a judge can read in 20 seconds.
- Consequences include the negative ones. No marketing.

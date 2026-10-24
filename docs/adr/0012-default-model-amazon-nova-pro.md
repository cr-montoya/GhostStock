# ADR 0012: Default Bedrock model is Amazon Nova Pro

- **Status:** accepted, amends 0007 (default model only)
- **Date:** 2026-10-24
- **Spec:** `.kiro/specs/01-api-bedrock/`, `.kiro/specs/03-infra-pipeline/`

## Context

The first deployed analyses failed with `ResourceNotFoundException`: Anthropic models
on Bedrock require a one-time use case form per account, plus up to 15 minutes before
access works. The demo could not wait.

## Options considered

1. **Amazon Nova Pro (`us.amazon.nova-pro-v1:0`)**: multimodal, supports Converse tool
   use with a forced tool, no extra form.
2. **Wait for the Anthropic form**: rejected for the demo window.

## Decision

`bedrockModelId` in `infra/cdk.json` is `us.amazon.nova-pro-v1:0`. The honest-AI
contract of ADR 0007 is unchanged: same forced `report_products` tool, same schema,
same error mapping. Claude Sonnet 4.5 can be restored by changing the context value
once the form is approved.

## Consequences

- **Positive:** analysis works on a fresh account.
- **Negative:** recognition quality may differ from Claude; verify with the fixture
  photos.
- **Follow-up:** compare both models on the fixtures and pick the default.

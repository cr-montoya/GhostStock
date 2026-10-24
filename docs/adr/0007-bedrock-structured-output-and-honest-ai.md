# ADR 0007: Bedrock structured output and the honest AI contract

- **Status:** accepted
- **Date:** 2026-10-24
- **Spec:** `.kiro/specs/00-contracts/`, `.kiro/specs/01-api-bedrock/`

## Context

The product rule is that the AI never invents prices, SKUs, barcodes or quantities,
and that empty or invalid analysis is never shown as success. The first draft asked
the model for estimated prices and quantities and rejected empty results as errors.

## Options considered

1. **Converse with a forced tool whose schema has no price, quantity or SKU fields,
   validated with the same zod schema**: fabrication is structurally impossible.
2. **Free-text JSON in the prompt and parse**: rejected, brittle and unenforceable.
3. **Ask for estimates and label them**: rejected, violates the product rule.

## Decision

- `ModelOutputSchema` (zod 4, strict) defines what the model may return: name,
  category, description, optional brand, confidence and optional notes, 0 to 10
  products. `z.toJSONSchema` produces the tool input schema from the same source.
- The analyses function forces the `report_products` tool, temperature 0, one call,
  retries only on throttling, 25 s abort.
- Empty is `200` with `candidates: []`; missing tool call or failed validation is
  `502 MODEL_INVALID_OUTPUT`; access problems are `503 MODEL_UNAVAILABLE`.
- Quantity, unit price and SKU exist only in `ReviewedProduct`, entered by the user.
- The model id is configuration (`bedrockModelId`), default the Claude Sonnet 4.5 US
  inference profile, fallback Claude Haiku 4.5.

## Consequences

- **Positive:** honesty enforced by types, not by prompt wording; one schema source.
- **Negative:** the user types every price and quantity (by design).
- **Follow-up:** switching models is a context change plus a quick quality check.

## Well-Architected notes

Reliability and security: untrusted output validated; bounded calls and spend.

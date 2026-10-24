---
inclusion: fileMatch
fileMatchPattern: "services/api/**"
---

# AI integration (Amazon Bedrock)

Contracts: #[[file:packages/contracts/src/schemas/analysis.ts]]
Decision record: ADR 0007 (`docs/adr/0007-bedrock-structured-output-and-honest-ai.md`).

## Model

- Converse API (`@aws-sdk/client-bedrock-runtime`), region `us-east-1`.
- `modelId` comes from `infra/cdk.json` context `bedrockModelId` and reaches the
  Lambda as `BEDROCK_MODEL_ID`. Never hard-coded in code.
- Default: the Claude Sonnet 4.5 US cross-region inference profile
  `us.anthropic.claude-sonnet-4-5-20250929-v1:0`. Fallback for speed or access issues:
  `us.anthropic.claude-haiku-4-5-20251001-v1:0`. Changing the default needs an ADR.
- Model access must be enabled in the account (documented in `docs/deployment.md`).

## Invocation

```
POST /api/analyses { imageKey }
  -> zod parse, imageKey regex check
  -> S3 HeadObject (size <= 5 MB, content type allowed) then GetObject bytes
     (Converse needs bytes; it does not accept URLs)
  -> ConverseCommand
       system: SYSTEM_PROMPT
       messages: [{ role: "user", content: [{ image: { format, source: { bytes } } },
                                            { text: USER_PROMPT }] }]
       toolConfig: { tools: [{ toolSpec: { name: "report_products",
                                           inputSchema: { json: ModelOutputJsonSchema } } }],
                     toolChoice: { tool: { name: "report_products" } } }
       inferenceConfig: { maxTokens: 2000, temperature: 0 }
  -> find the toolUse block named report_products
  -> ModelOutputSchema.safeParse(toolUse.input)
  -> map to ProductCandidate[] (server assigns candidate ids)
  -> 200 { analysisId, imageKey, candidates, modelId, latencyMs }
```

`ModelOutputJsonSchema` is produced by `z.toJSONSchema(ModelOutputSchema)` (zod 4) in
`packages/contracts`, so the tool schema and the validator are the same source.

## What the model returns (and nothing else)

`products[]`, max 10, each: `name`, `category` (enum), `description`, `brand`
(optional, only if visibly identifiable), `confidence` (`high | medium | low`),
`notes` (optional uncertainty, e.g. "etiqueta parcialmente visible"). Text in Spanish.
No price, quantity, SKU or barcode fields exist in the schema, so the model cannot
return them.

## Prompt rules (`services/api/src/bedrock/prompt.ts`)

- English instructions, Spanish output values.
- Identify distinct sellable products visible in the photo; group identical units as
  one product (the user sets the quantity).
- Prefer generic names over guessed brands; set `brand` only if the brand is legible.
- Use `confidence: low` and `notes` instead of guessing.
- If nothing is recognizable, call the tool with `products: []`.
- Never output prices, quantities, SKUs, barcodes or any number not printed on the
  product.

## Invariants

1. **No fabrication.** Empty `products` -> `200` with `candidates: []`. The UI renders
   the zero-detections state.
2. **Untrusted output.** A missing tool call, wrong tool name, `stopReason` other than
   `tool_use`, or a zod failure -> `502 MODEL_INVALID_OUTPUT`. No partial salvage.
3. **Bounded calls.** One Converse call per request. Retry only
   `ThrottlingException` / `ServiceUnavailableException`, 2 retries, 400 ms and 1200 ms.
   Then `503 MODEL_THROTTLED` (`retryable: true`).
4. **Access failures are explicit.** `AccessDeniedException`,
   `ResourceNotFoundException`, `ValidationException` about the model ->
   `503 MODEL_UNAVAILABLE` (`retryable: false`), logged with the model id.
5. **Privacy.** Never log image bytes, base64, the raw model text, or presigned URLs.
   Log `analysisId`, `imageKey`, `modelId`, `latencyMs`, `candidateCount`, error code.
6. **Plain text.** Candidate text is rendered as text in the UI, never as HTML.

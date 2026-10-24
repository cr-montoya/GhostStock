# AI Integration

## Model

Amazon Bedrock, Converse API. Model ID: `anthropic.claude-3-sonnet-20240229-v1:0`.
No other model is used without an ADR update.

## Invocation pattern

```
POST /api/analyze
  → Lambda validateRequest (zod)
  → presigned GET for the S3 object (image bytes never pass through Lambda)
  → bedrockClient.send(ConverseCommand)
      messages: [{ role: "user", content: [{ image block }, { text prompt }] }]
      toolConfig: { tools: [productCandidatesTool], toolChoice: { any: {} } }
  → parse toolUse block from response
  → validate with ProductCandidatesSchema (zod, from packages/contracts)
  → return candidates or explicit error
```

Forced tool use (`toolChoice: { any: {} }`) ensures Bedrock always returns a
structured tool call. The response is never treated as free text.

## Tool definition

Defined in `services/api/src/bedrock/tools.ts`, imported from the zod schema in
`packages/contracts`. The JSON Schema passed to Bedrock is generated from the zod
schema at build time to keep a single source of truth.

```typescript
// packages/contracts/src/schemas/product.ts (excerpt)
export const ProductCandidateSchema = z.object({
  name:             z.string().max(120),
  description:      z.string().max(500),
  category:         z.enum(PRODUCT_CATEGORIES),
  estimatedPrice:   z.number().nonneg(),
  currency:         z.literal("COP"),
  quantity:         z.number().int().nonneg(),
  skuHint:          z.string().max(50).optional(),
  barcode:          z.string().max(50).optional(),
});

export const ProductCandidatesSchema = z.object({
  candidates: z.array(ProductCandidateSchema).min(1).max(5),
});
```

## Invariants — never break these

1. **No fabrication.** If Bedrock returns an empty candidates array, a malformed tool
   call, a validation error, or a non-tool-use stop reason, the handler returns an
   explicit `ANALYSIS_FAILED` or `NO_CANDIDATES` error. It never returns invented data.
2. **Untrusted output.** Bedrock responses are validated with the zod schema before any
   downstream use. A schema failure is a hard error, not a fallback.
3. **No image bytes in logs.** Never log base64 strings, raw image bytes, or presigned
   URLs. Log the S3 key and the Bedrock request ID only.
4. **No unbounded calls.** Each `/api/analyze` request issues exactly one Converse call.
   Retries (up to 2) happen only on throttling (`ThrottlingException`) with exponential
   back-off. No retries on model errors.
5. **Prices are estimates.** The UI and the saved item record must label all
   `estimatedPrice` values as estimates ("Precio estimado"). Never present them as
   authoritative prices.
6. **Currency is COP.** The model is prompted to estimate in Colombian Pesos. The schema
   enforces `currency: "COP"`. If the model returns a different currency, the record
   fails validation.

## Prompt

Prompt text lives in `services/api/src/bedrock/prompt.ts`. It is in English (model
performs better) but instructs the model to assume the product is sold in Colombia and
to price in COP.

Key instructions to include:
- Identify up to 5 distinct product candidates visible in the image.
- For each, propose name, description, category, estimated retail price in COP,
  typical quantity per unit, and barcode/SKU if visible.
- If no products are identifiable, return an empty candidates array.
- Do not invent barcodes or SKUs that are not visible in the image.
- Respond only via the `propose_product_candidates` tool.

## Error states surfaced to the user (in Spanish)

| Code | Cause | UI message |
| --- | --- | --- |
| `NO_CANDIDATES` | Model returned 0 candidates | "No se identificaron productos en la imagen. Intenta con otra foto." |
| `ANALYSIS_FAILED` | Validation error or non-tool-use response | "No fue posible analizar la imagen. Por favor intenta de nuevo." |
| `IMAGE_TOO_LARGE` | > 5 MB after presigned POST check | "La imagen es demasiado grande (máx. 5 MB)." |
| `UNSUPPORTED_TYPE` | Not JPEG / PNG / WEBP | "Formato no admitido. Usa JPEG, PNG o WEBP." |
| `THROTTLED` | Bedrock throttling after retries | "Servicio temporalmente ocupado. Intenta en unos segundos." |

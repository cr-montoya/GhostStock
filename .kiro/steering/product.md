# Product: GhostStock

> **Bring Your Inventory Back From the Dead.**

## Vision

Photograph physical products, let Amazon Bedrock propose structured product candidates,
review and save them, then manage a searchable inventory dashboard with stats and CSV
export.

**North star:** upload photo → analyze with Bedrock → review → save → dashboard.
Everything else is secondary.

**Event context:** Built for Kiro Day Medellin 2026.

## User journey (happy path)

1. User opens the app (in Spanish).
2. User uploads a product photo (JPEG / PNG / WEBP, ≤ 5 MB).
3. App sends the image to the API, which calls Bedrock.
4. Bedrock returns up to 5 product candidates: name, description, category, estimated
   price, quantity, SKU hint, barcode.
5. User reviews the candidates, edits fields if needed, and saves one or more items.
6. Items appear immediately in the inventory dashboard.
7. User can search, filter, view stats, and export to CSV.

## Personas

- **Primary:** small-business owner or stockroom worker with physical goods and no
  digital catalog. Non-technical, mobile-first, works in Spanish.
- **Secondary:** hackathon judge evaluating a live demo in under three minutes.

## Out of scope (v1)

- Multi-user / authentication (single-user demo).
- Real barcode scanning (AI proposes, user confirms).
- Bulk / multi-photo upload in one step.
- Price lookup from external data sources.
- Offline mode.

## Success criteria (demo)

- Photo → analyzed candidates on screen in < 5 s on a standard connection.
- Zero fabricated results: invalid or empty Bedrock output surfaces a clear error state.
- Dashboard shows total items, total estimated value, top category.
- CSV export downloads cleanly.
- UI is fully in Spanish with no English strings visible to the user.

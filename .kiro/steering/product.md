---
inclusion: always
---

# Product: GhostStock

> **Bring Your Inventory Back From the Dead.**

How we work (specs, gates, agents, git): #[[file:AGENTS.md]]

## Vision

Turn physical products into a usable digital inventory in seconds. The user
photographs products, Amazon Bedrock identifies product candidates, the user reviews
and completes them, and the inventory comes alive in a premium, Halloween-flavored
dashboard with search, filters, stats and CSV export.

**North star (the only thing that must work end to end):**
upload photo -> analyze with Bedrock -> review -> save -> dashboard.

## Division of truth between AI and user

| Field | Who provides it |
| --- | --- |
| name, category, description, brand (optional) | Bedrock proposes, user can edit |
| confidence (high / medium / low), uncertainty notes | Bedrock, read-only |
| quantity, unit price (COP), SKU (optional) | **User only.** The model never proposes them |

The model never invents prices, SKUs, barcodes or quantities. Zero detections is a
valid, honest outcome, never an error disguised as success or a fabricated result.

## User journey

1. Opens the app on the dashboard ("Tu almacén"). Empty warehouse -> ghost empty
   state with one call to action: "Invocar inventario".
2. Takes or uploads a photo (JPEG, PNG, WebP, up to 5 MB). The browser downscales it.
3. Resurrection screen while Bedrock analyzes ("Invocando tu inventario...").
4. Candidates rise as editable cards ("Los productos han vuelto a la vida.").
5. User removes false detections, edits names and categories, enters quantity, unit
   price and optional SKU, and saves the selected ones.
6. Dashboard: total products, total units, inventory value, categories, low stock.
7. Inventory: search, category filter, edit, delete, CSV export.

## Personas

- **Primary:** small shop owner or stockroom worker in Colombia, phone first,
  non-technical, Spanish speaking.
- **Secondary:** hackathon judge watching a live demo of under three minutes.

## Scope

- Single inventory workspace, no authentication, no multi-tenancy.
- Out of scope: Cognito, payments, barcode scanning, price lookup, bulk multi-photo
  upload, offline mode, bounding boxes, image generation, custom models, agents.

## Demo success criteria

- Photo to candidates on screen in under 10 s for a typical photo.
- Zero fabricated results; every failure has an explicit Spanish state.
- Dashboard KPIs update right after saving.
- CSV opens correctly in Excel (UTF-8 BOM, Spanish headers).
- Not a single English string visible in the UI.

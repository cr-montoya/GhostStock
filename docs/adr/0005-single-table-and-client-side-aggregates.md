# ADR 0005: Single-table DynamoDB and client-side aggregates

- **Status:** accepted
- **Date:** 2026-10-24
- **Spec:** `.kiro/specs/00-contracts/`, `.kiro/specs/01-api-bedrock/`

## Context

One inventory workspace, a few hundred products at most, a one-day build. The
dashboard needs totals, categories and low stock; the inventory needs search, filters
and CSV. The first Kiro draft keyed items by `ITEM#<ulid>` with a category GSI, which
cannot list all products without a Scan.

## Options considered

1. **One partition `WS#default`, sort key `PRODUCT#<ulid>`, aggregates in the
   browser**: one Query reads the whole inventory, newest first by ULID.
2. **Item-per-partition with GSIs for category and date**: rejected, needs a Scan for
   the unfiltered list and adds indexes nobody needs at this size.
3. **Server-side stats and CSV endpoints**: rejected, two more code paths and a Lambda
   for data the browser already holds.

## Decision

Single table with `PK = WS#default` and `SK = PRODUCT#<ulid>` or `SETTINGS`. No GSI.
Listing is one paginated Query capped at 1 000 items. Stats, low stock and CSV are
computed by pure helpers in `@ghoststock/contracts` (`computeInventoryStats`,
`productsToCsv`) so the web app and the tests use the same math.

## Consequences

- **Positive:** fewer resources, one access pattern, identical numbers everywhere.
- **Negative:** a hot partition and a 1 000 item ceiling; fine for one workspace.
- **Follow-up:** multi-tenancy would make the workspace id part of `PK` and add
  pagination to the UI.

## Well-Architected notes

Cost and performance efficiency: on-demand table, single Query, no idle indexes.

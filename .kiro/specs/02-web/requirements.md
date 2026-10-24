# Requirements Document: 02-web

## Introduction

The GhostStock web app: a Spanish, mobile-first React SPA served by CloudFront on the
same origin as the API. It must be functional end to end **and** visually exceptional
(judging criterion). Identity, tokens and copy: `ui-identity.md`. Tests:
`testing.md`. Owns `apps/web/**`, `e2e/web/**` and the Playwright workspace scaffold
(`e2e/package.json`, `e2e/playwright.config.ts`).

## Requirements

### Requirement 1: Design system

**User Story:** As a judge, I want the app to look premium and distinctive at first
glance, so that GhostStock stands out.

#### Acceptance Criteria

1. THE web app SHALL define every color, radius and font from `ui-identity.md` as CSS
   variables in `tokens.css`, mapped to Tailwind and shadcn/ui, with no raw hex values
   in component files.
2. THE web app SHALL self-host Fraunces, Geist and Geist Mono and use tabular numerals
   for money and counts.
3. THE web app SHALL render the grain overlay, violet glows and fog layer described in
   `ui-identity.md` on every screen.

### Requirement 2: Navigation shell

**User Story:** As a phone user, I want to move between screens with my thumb.

#### Acceptance Criteria

1. THE web app SHALL show a bottom tab bar on viewports under 768 px and a left
   sidebar on wider viewports, with Almacén, Invocar, Inventario and Ajustes.
2. WHEN the user presses Ctrl+K or Cmd+K, THE web app SHALL open a command palette
   that searches products by name, brand, SKU and category and navigates to screens.

### Requirement 3: The ritual (photo selection)

**User Story:** As the user, I want to take or pick a photo easily on any device.

#### Acceptance Criteria

1. THE `/invocar` screen SHALL show the summoning-circle drop zone, accept drag and
   drop and file picking, and on phones offer a camera button
   (`capture="environment"`).
2. IF the file is not JPEG, PNG or WebP, or the original is over 25 MB, THEN THE web
   app SHALL show an inline Spanish error and SHALL NOT upload.
3. WHEN a valid file is chosen, THE web app SHALL downscale it in the browser to at
   most 1568 px on the long edge, re-encode it as JPEG (quality 0.85) unless it is
   already smaller, and show a preview.
4. IF the processed image is still over 3 750 000 bytes, THEN THE web app SHALL retry
   the encode at quality 0.7 and, if still too large, show the size error.

### Requirement 4: Upload and resurrection (analysis)

**User Story:** As the user, I want to see my products being "resurrected" while the
AI works, so that the wait feels intentional.

#### Acceptance Criteria

1. WHEN the user confirms the photo, THE web app SHALL request an upload slot, POST
   the file to S3 with the returned fields, then call `POST /api/analyses`.
2. WHILE the upload or analysis is in flight, THE web app SHALL show the resurrection
   screen (photo frame, scan line, fog, rotating status copy every 1.8 s) and announce
   the status through an `aria-live="polite"` region.
3. IF any step fails, THEN THE web app SHALL show the Spanish message for the error
   code (or a network message), keep the photo, and offer "Reintentar" and
   "Elegir otra foto".
4. WHEN the analysis returns zero candidates, THE web app SHALL show the
   zero-detections state with its copy and the same two actions, never an error toast.

### Requirement 5: Review candidates

**User Story:** As the user, I want to correct what the AI saw and add what only I
know, so that the saved inventory is right.

#### Acceptance Criteria

1. WHEN candidates arrive, THE web app SHALL animate them rising from the photo
   (staggered spring, ectoplasm glow) with the heading "Los productos han vuelto a la
   vida."
2. EACH candidate card SHALL show the analyzed photo (full frame, no crops: the
   contract has no bounding boxes), an editable name, a category
   select, an editable description, the brand if any, a confidence chip (alta, media,
   baja) with the model notes, and empty inputs for cantidad, precio unitario (COP)
   and SKU.
3. THE web app SHALL let the user discard a candidate, restore it, and select or
   deselect it for saving.
4. THE "Guardar seleccionados" action SHALL be enabled only when at least one
   candidate is selected and **every** selected candidate has a valid name, category,
   quantity and unit price; invalid selected cards SHALL show their field errors, and
   only selected candidates are sent.
5. THE web app SHALL NOT prefill quantity, price or SKU.

### Requirement 6: Save

**User Story:** As the user, I want saving to feel like the warehouse waking up.

#### Acceptance Criteria

1. WHEN the user saves, THE web app SHALL call `POST /api/products` with the selected
   reviewed products and the `imageKey`, and SHALL disable the save action while the
   request is in flight (a manual retry after a timeout may duplicate products; this
   risk is accepted for the MVP).
2. WHEN saving succeeds, THE web app SHALL show the toast "Tu almacén ha despertado.",
   refresh the product data and navigate to `/`, where the KPIs count up.
3. IF saving fails, THEN THE web app SHALL keep every edit and show the error with a
   retry action.

### Requirement 7: Dashboard (Almacén)

**User Story:** As the owner, I want to understand my inventory at a glance.

#### Acceptance Criteria

1. THE `/` screen SHALL show KPI cards for productos, unidades, valor del inventario
   (COP) and categorías, computed with `computeInventoryStats`.
2. THE `/` screen SHALL show value by category, the category distribution, the
   low-stock list (quantity at or under the configured threshold, in ember) and the
   most recent products with photos.
3. WHEN the inventory is empty, THE `/` screen SHALL show the ghost empty state with
   "Invocar inventario".

### Requirement 8: Inventory list

**User Story:** As the owner, I want to find, edit and remove products quickly.

#### Acceptance Criteria

1. THE `/inventario` screen SHALL list products as a table on wide viewports and as
   cards on phones, each with photo, name, category, quantity, unit price, total value
   and a low-stock badge when applicable.
2. WHEN the user types in search or picks category chips, THE list SHALL filter on the
   client by name, description, brand and SKU, and by category, without API calls.
3. WHEN the user edits a product, THE web app SHALL open a drawer with the product
   form, save with `PUT /api/products/{id}`, and update the list optimistically with
   rollback on error.
4. WHEN the user deletes a product, THE web app SHALL ask for confirmation and then
   call `DELETE /api/products/{id}`.
5. WHEN the user presses "Exportar CSV", THE web app SHALL download
   `ghoststock-inventario-<YYYY-MM-DD>.csv` built with `productsToCsv` from the
   currently filtered list.

### Requirement 9: Settings

**User Story:** As the owner, I want to set my low-stock threshold.

#### Acceptance Criteria

1. THE `/ajustes` screen SHALL load and save `lowStockThreshold` and the dashboard and
   inventory SHALL use the saved value.

### Requirement 10: States, language and accessibility

**User Story:** As any user, I want every screen to be clear, in Spanish and usable
without a mouse.

#### Acceptance Criteria

1. EVERY data screen SHALL implement loading (skeletons), empty, error (with retry)
   and success states.
2. THE web app SHALL contain no English user-visible text; all copy lives in
   `src/copy/es.ts`.
3. WHEN `prefers-reduced-motion: reduce` is set, THE web app SHALL replace every
   animation with an opacity-only fade of at most 150 ms (no translate, scale or blur)
   and stop all loops.
4. THE web app SHALL have no serious or critical axe violations on any screen and SHALL
   allow the full upload, review and save path by keyboard.

### Requirement 11: Mocks and tests

**User Story:** As the web builder, I want to work without the backend and prove every
criterion.

#### Acceptance Criteria

1. WHEN running in development, THE web app SHALL serve the API through MSW handlers
   built from contract fixtures, with scenarios selected by `?scenario=` (`happy`,
   `empty`, `zero-candidates`, `model-error`, `throttled`, `network-error`).
2. THE production build SHALL NOT include MSW.
3. THE `e2e/web` Playwright projects SHALL cover Requirements 2 to 10 on desktop and
   phone viewports, including axe checks and reduced motion; Requirement 1 SHALL be
   covered by the `visual` baselines plus a Vitest check that no file under
   `apps/web/src` except `styles/tokens.css` contains a hex color literal.
5. IF an error response is not a valid `ApiError` envelope (HTTP API 429, CloudFront
   5xx, empty body), THEN THE web app SHALL treat it as a generic retryable error with
   its own Spanish message; a `204` response SHALL be accepted without a body.
4. THE `visual` Playwright project SHALL keep screenshot baselines of every screen and
   state for local review.

# Tasks: 02-web

## Implementation tasks

- [ ] 1. Scaffold `apps/web` workspace
  - [ ] 1.1 Create `apps/web/package.json` with all dependencies from design.md
  - [ ] 1.2 Create `apps/web/tsconfig.json` (strict, bundler module resolution)
  - [ ] 1.3 Create `apps/web/vite.config.ts` with React plugin and `/api` proxy to `http://localhost:3000`
  - [ ] 1.4 Create `apps/web/index.html` with `<div id="root">` and Spanish `lang="es"`
  - [ ] 1.5 Add `apps/web` to the root workspaces array

- [ ] 2. Design tokens and Tailwind
  - [ ] 2.1 Create `src/styles/tokens.css` with all CSS custom properties from the ui-identity steering file
  - [ ] 2.2 Create `tailwind.config.ts` extending shadcn/ui defaults with design token CSS variables
  - [ ] 2.3 Run `npx shadcn@latest init` and add components: button, card, input, textarea, badge, dialog, toast, checkbox, select, separator

- [ ] 3. API client (`src/api/`)
  - [ ] 3.1 `client.ts` — `apiFetch<T>()` with `ApiError` class carrying `ErrorCode`
  - [ ] 3.2 `analyze.ts` — `getUploadUrl()`, `uploadToS3()`, `analyzePhoto()`
  - [ ] 3.3 `items.ts` — `saveItems()`, `listItems()`, `getItem()`, `updateItem()`, `deleteItem()`, `exportCsv()`

- [ ] 4. MSW setup
  - [ ] 4.1 Install MSW and run `npx msw init public/`
  - [ ] 4.2 `src/mocks/browser.ts` — set up service worker
  - [ ] 4.3 `src/mocks/handlers.ts` — all 8 route handlers from design.md using contracts fixtures
  - [ ] 4.4 `src/main.tsx` — conditionally start MSW when `import.meta.env.DEV`

- [ ] 5. Shared components
  - [ ] 5.1 `src/lib/utils.ts` — `cn()` helper
  - [ ] 5.2 `src/components/ErrorMessage.tsx` — reusable error display with retry callback
  - [ ] 5.3 `src/components/ConfirmDialog.tsx` — shadcn Dialog-based confirmation with cancel/confirm
  - [ ] 5.4 `src/components/CategoryChips.tsx` — category filter chip group
  - [ ] 5.5 `src/components/StatRow.tsx` — three stat cards with COP currency formatting

- [ ] 6. Upload page (`src/pages/UploadPage.tsx`)
  - [ ] 6.1 `src/components/UploadZone.tsx` — drag-and-drop, file-picker, thumbnail preview, four states
  - [ ] 6.2 Implement full upload → presign → S3 upload → analyze → navigate flow
  - [ ] 6.3 Spanish error messages for all `ErrorCode` values

- [ ] 7. Review page (`src/pages/ReviewPage.tsx`)
  - [ ] 7.1 `src/components/CandidateCard.tsx` — checkbox, inline edit, "Precio estimado" label, category badge
  - [ ] 7.2 "Guardar seleccionados" button disabled until ≥ 1 checked
  - [ ] 7.3 Save flow: `POST /api/items`, success toast, navigate to `/inventario`
  - [ ] 7.4 Redirect to `/` if no router state

- [ ] 8. Inventory page (`src/pages/InventoryPage.tsx`)
  - [ ] 8.1 `src/components/InventoryTable.tsx` — responsive table/card grid, sort, row actions
  - [ ] 8.2 `StatRow` wired to loaded items
  - [ ] 8.3 Search box with client-side filter
  - [ ] 8.4 "Exportar CSV" button triggering download
  - [ ] 8.5 Empty state with illustration and CTA

- [ ] 9. Item detail page (`src/pages/ItemDetailPage.tsx`)
  - [ ] 9.1 `src/components/ItemForm.tsx` — full editable form pre-filled from API
  - [ ] 9.2 Save via `PUT /api/items/:id` with success toast
  - [ ] 9.3 Delete via `DELETE /api/items/:id` with `ConfirmDialog`, then navigate to `/inventario`

- [ ] 10. Router and app shell
  - [ ] 10.1 `src/App.tsx` — `createBrowserRouter` with all four routes
  - [ ] 10.2 Page transition animations with `framer-motion` and `useReducedMotion()` guard

- [ ] 11. Tests
  - [ ] 11.1 `UploadZone.test.tsx` — file validation (oversize, wrong type), idle and error states
  - [ ] 11.2 `CandidateCard.test.tsx` — inline edit, checkbox, price label
  - [ ] 11.3 `InventoryPage.test.tsx` — search filter, empty state, stat row values
  - [ ] 11.4 `ReviewPage.test.tsx` — save button disabled state, redirect without state

- [ ] 12. Build and verify
  - [ ] 12.1 `npm run build` exits 0 (Vite build, no TypeScript errors)
  - [ ] 12.2 `npm test` exits 0 with all tests passing

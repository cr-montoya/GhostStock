# Design: 02-web

## Package structure

```
apps/web/
├── public/
│   └── mockServiceWorker.js      # MSW service worker (generated, gitignored)
├── src/
│   ├── api/
│   │   ├── client.ts             # fetch wrapper, base URL /api
│   │   ├── analyze.ts            # getUploadUrl(), uploadToS3(), analyzePhoto()
│   │   └── items.ts              # saveItems(), listItems(), getItem(), updateItem(), deleteItem(), exportCsv()
│   ├── components/
│   │   ├── ui/                   # shadcn/ui generated components (do not edit manually)
│   │   ├── UploadZone.tsx
│   │   ├── CandidateCard.tsx
│   │   ├── InventoryTable.tsx
│   │   ├── StatRow.tsx
│   │   ├── CategoryChips.tsx
│   │   ├── ItemForm.tsx
│   │   ├── ConfirmDialog.tsx
│   │   └── ErrorMessage.tsx
│   ├── pages/
│   │   ├── UploadPage.tsx        # route /
│   │   ├── ReviewPage.tsx        # route /revisar
│   │   ├── InventoryPage.tsx     # route /inventario
│   │   └── ItemDetailPage.tsx    # route /inventario/:id
│   ├── mocks/
│   │   ├── browser.ts            # MSW browser setup
│   │   └── handlers.ts           # MSW handlers from contracts fixtures
│   ├── styles/
│   │   └── tokens.css            # CSS custom properties (design tokens)
│   ├── lib/
│   │   └── utils.ts              # cn() helper (shadcn pattern)
│   ├── App.tsx                   # router setup (React Router v6)
│   └── main.tsx                  # entry point, MSW bootstrap
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Routing

React Router v6 (`createBrowserRouter`):

| Path | Component | Title (Spanish) |
| --- | --- | --- |
| `/` | `UploadPage` | GhostStock |
| `/revisar` | `ReviewPage` | Revisar productos |
| `/inventario` | `InventoryPage` | Mi inventario |
| `/inventario/:id` | `ItemDetailPage` | Detalle del producto |

Navigation state: candidates from the analyze call are passed via router `state`
(`{ candidates, photoKey }`) from `UploadPage` to `ReviewPage`. If `ReviewPage` is
accessed without state, it redirects to `/`.

## API client

`src/api/client.ts` wraps `fetch`. All calls go to `/api/*` (same origin in
production; Vite proxy to `http://localhost:3000` in dev).

```typescript
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T>
// throws ApiError (with .code: ErrorCode) on non-2xx
```

## State management

No external state library. React `useState` and `useReducer` per page. The inventory
list is fetched fresh on `/inventario` mount. Search/filter is applied client-side
with `useMemo`.

## Key component behaviors

### `UploadZone`
- Drag-and-drop via HTML5 drag events + `<input type="file" accept="image/jpeg,image/png,image/webp">`.
- Client-side validation: size ≤ 5 MB, type in allowed list.
- Shows thumbnail preview via `URL.createObjectURL`.
- States: idle, dragging, uploading (progress bar), error.

### `CandidateCard`
- Displays one `ProductCandidate`.
- Checkbox for selection (controlled by parent).
- Inline edit: clicking name, description, price, or quantity opens an `<input>` /
  `<textarea>` in place; `onBlur` commits to local state.
- Category badge uses a color map (one Tailwind class per category, defined in a
  `CATEGORY_COLORS` constant).
- "Precio estimado" label is always shown next to the price.

### `InventoryTable`
- Responsive: card grid on mobile, table on `md+`.
- Columns: nombre, categoría, precio estimado, cantidad, acciones.
- Sort by name or createdAt (ascending/descending toggle).
- Row actions: edit (→ `/inventario/:id`), delete (opens `ConfirmDialog`).

### `StatRow`
- Derives stats from the loaded items array: `total`, `totalValue` (sum of
  `estimatedPrice × quantity`), `topCategory` (most frequent).
- Formatted numbers use `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' })`.

## Motion spec

All animations use `motion` from `framer-motion` and respect `useReducedMotion()`.

```typescript
const reducedMotion = useReducedMotion();
const transition = reducedMotion ? { duration: 0 } : { duration: 0.25 };
```

| Interaction | Animation |
| --- | --- |
| Page mount | `opacity: 0→1`, `y: 16→0`, 400 ms |
| Candidate card entry | Staggered `opacity: 0→1`, 60 ms stagger |
| Upload success checkmark | Scale 0→1, 250 ms spring |
| Toast | Slide in from bottom-right, 250 ms; auto-dismiss 4 s |

## MSW handlers

`src/mocks/handlers.ts` covers:
- `GET /api/upload-url` → `{ url, fields, key }` (fake S3 endpoint, no real upload)
- `POST /api/analyze` → `{ candidates: [sampleCandidate, ...] }` from fixtures
- `POST /api/items` → `{ saved: [sampleItem] }`
- `GET /api/items` → `{ items: [sampleItem], total: 1 }`
- `GET /api/items/:id` → `sampleItem` or 404
- `PUT /api/items/:id` → updated item
- `DELETE /api/items/:id` → 204
- `GET /api/items/export` → minimal CSV blob

## Package configuration

```json
{
  "name": "@ghoststock/web",
  "dependencies": {
    "@ghoststock/contracts": "*",
    "react": "18.3.x",
    "react-dom": "18.3.x",
    "react-router-dom": "6.x",
    "framer-motion": "11.x"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "4.x",
    "vite": "5.x",
    "tailwindcss": "3.x",
    "msw": "2.x",
    "vitest": "2.1.8",
    "@testing-library/react": "16.x",
    "@testing-library/user-event": "14.x",
    "jsdom": "25.x",
    "typescript": "5.6.3"
  }
}
```

shadcn/ui components are installed via CLI (`npx shadcn@latest add ...`) and live in
`src/components/ui/`. They are not listed as npm dependencies.

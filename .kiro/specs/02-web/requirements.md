# Requirements: 02-web

## Overview

React 18 SPA (Vite, Tailwind CSS, shadcn/ui, Framer Motion). UI fully in Spanish.
Communicates with the API through same-origin `/api/*`. All types come from
`@ghoststock/contracts`. MSW mocks during development.

## Requirements

### EARS-1 — Upload screen
WHEN the user opens the app (`/`),
THE SYSTEM SHALL display a drag-and-drop zone with a camera icon and a file-picker
trigger, accepting JPEG, PNG, and WEBP files up to 5 MB.

### EARS-2 — File validation feedback
WHEN the user selects a file that exceeds 5 MB or has an unsupported type,
THE SYSTEM SHALL display an inline error in Spanish before uploading.

### EARS-3 — Upload and analyze flow
WHEN the user selects a valid file,
THE SYSTEM SHALL obtain a presigned POST URL, upload the file directly to S3,
call `POST /api/analyze`, and navigate to `/revisar` with the candidates on success.

### EARS-4 — Analysis progress state
WHILE the analysis is in flight,
THE SYSTEM SHALL display a progress indicator and disable the upload trigger.

### EARS-5 — Analysis error state
WHEN the API returns an error (`NO_CANDIDATES`, `ANALYSIS_FAILED`, `THROTTLED`, etc.),
THE SYSTEM SHALL display the corresponding Spanish error message and a retry button.

### EARS-6 — Review candidates screen
WHEN the user arrives at `/revisar`,
THE SYSTEM SHALL display up to 5 product candidate cards, each showing name,
category badge, estimated price (labeled "Precio estimado"), and quantity.

### EARS-7 — Inline editing of candidates
WHEN the user edits a candidate field (name, description, price, quantity),
THE SYSTEM SHALL update the local state immediately without a round-trip to the API.

### EARS-8 — Save selected candidates
WHEN the user selects at least one candidate and presses "Guardar seleccionados",
THE SYSTEM SHALL call `POST /api/items`, show a success toast, and navigate to
`/inventario`.

### EARS-9 — Inventory dashboard
WHEN the user opens `/inventario`,
THE SYSTEM SHALL display: a stat row (total items, total estimated value, top
category), a searchable and sortable item list/grid, category filter chips, and an
"Exportar CSV" button.

### EARS-10 — Dashboard empty state
WHEN the inventory has zero items,
THE SYSTEM SHALL display an illustration and the message
"Aún no tienes productos. ¡Empieza subiendo una foto!" with a link to `/`.

### EARS-11 — Search and filter
WHEN the user types in the search box or selects a category chip,
THE SYSTEM SHALL filter the displayed items client-side by name/description and
category without a new API call (items already loaded).

### EARS-12 — CSV export
WHEN the user presses "Exportar CSV",
THE SYSTEM SHALL trigger a download of the CSV returned by `GET /api/items/export`.

### EARS-13 — Item detail and edit
WHEN the user opens `/inventario/:id`,
THE SYSTEM SHALL display the full item form pre-filled with current values,
save changes via `PUT /api/items/:id`, and allow deletion via `DELETE /api/items/:id`
with a confirmation dialog.

### EARS-14 — Four explicit UI states
EVERY screen SHALL implement loading, empty, error, and success states.
No state is implicit or silently missing.

### EARS-15 — Reduced motion
EVERY animation SHALL be disabled or simplified when
`prefers-reduced-motion: reduce` is detected.

### EARS-16 — Accessibility
THE SYSTEM SHALL meet WCAG 2.1 AA for all interactive components: visible focus
rings, sufficient contrast, ARIA labels where native semantics are insufficient,
keyboard operability.

### EARS-17 — MSW development mocks
WHEN running in development mode (`import.meta.env.DEV`),
THE SYSTEM SHALL activate MSW service-worker handlers that serve responses built
from the `@ghoststock/contracts` fixtures, so development does not require a live API.

### EARS-18 — No English user-visible strings
ALL user-visible text SHALL be in Spanish. No English strings SHALL appear in the UI.

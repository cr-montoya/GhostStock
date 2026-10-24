# UI Identity

## Language

All user-visible strings are in **Spanish**. No English text reaches the UI. Code,
comments, specs, docs, and commits are in English.

## Design principles

1. **Mobile-first.** The primary persona is a stockroom worker with a phone. Layout
   breakpoints: base (mobile) → `md` (tablet) → `lg` (desktop).
2. **Purposeful motion.** Animations communicate state changes, not decoration.
   Every animation respects `prefers-reduced-motion: reduce`.
3. **Four explicit states.** Every screen has loading, empty, error, and success states
   modeled in the component. None is implicit or silently missing.
4. **Accessible by default.** WCAG 2.1 AA minimum. Semantic HTML, visible focus rings,
   sufficient color contrast, ARIA labels where native semantics fall short.

## Design tokens

All colors, radii, spacing and type scales live as CSS custom properties wired into
Tailwind's config and into shadcn/ui's theme. No raw hex values in component files.

```
--color-brand-500      primary action color
--color-brand-600      hover / pressed
--color-surface        page background
--color-surface-raised card / panel background
--color-text-primary   body text
--color-text-secondary muted / helper text
--color-destructive    error, delete
--color-success        confirmed save
--radius-card          card border radius
```

Specific values are set in `apps/web/src/styles/tokens.css` and extended in
`tailwind.config.ts`.

## Component library

shadcn/ui components only. No third-party UI component libraries are added without
an ADR. Custom components are built from shadcn primitives and Radix UI.

## Motion

Framer Motion (imported as `motion` from `framer-motion`) for:
- Page / route transitions: fade + subtle upward translate.
- List item entry: staggered fade-in (max 5 items, 60 ms stagger).
- Upload progress: indeterminate spinner → checkmark on success.
- Toast / notification: slide in from bottom-right, auto-dismiss 4 s.

Animation durations: 150 ms (micro), 250 ms (standard), 400 ms (page). Use
`useReducedMotion()` to disable or simplify all animations when the user prefers.

## Key screens

### Upload & analyze (`/`)
- Large drag-and-drop zone with a camera icon; tap to open file picker on mobile.
- Preview thumbnail immediately after selection.
- Progress bar while the API call is in flight.
- Error state: descriptive message in Spanish with a retry button.

### Review candidates (`/revisar`)
- Card list of up to 5 Bedrock candidates.
- Each card: name, category badge, estimated price, editable quantity.
- Inline edit for name, description, price, quantity before saving.
- "Guardar seleccionados" CTA; disabled until at least one item is checked.

### Inventory dashboard (`/inventario`)
- Stat row: total items, total estimated value, top category.
- Searchable, sortable table or card grid (responsive).
- Filter by category chip group.
- "Exportar CSV" button top-right.
- Empty state: illustration + "Aún no tienes productos. ¡Empieza subiendo una foto!"

### Item detail / edit (`/inventario/:id`)
- Full editable form; save and delete actions.
- Delete requires a confirmation dialog.

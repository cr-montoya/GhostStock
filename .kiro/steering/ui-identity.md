---
inclusion: fileMatch
fileMatchPattern: "apps/web/**"
---

# UI identity

The UI is a judging criterion. "It works" is not enough: it must feel premium,
cinematic and unmistakably GhostStock. Review every screen with the `visual-qa` skill.

## Mood

A haunted warehouse at night, lit by violet glow and green ectoplasm. Linear or
Vercel grade SaaS polish with Halloween personality. Elegant, never childish: no
cartoon pumpkins, no bats, no dripping fonts, no clutter, no gimmicks that hurt
legibility.

## Language and voice

- Every visible string in Spanish (Colombia). Code, specs and commits in English.
- Voice: confident, a little theatrical, always clear. The theme lives in headlines
  and moments; buttons, labels and errors stay plain and actionable.
- All copy lives in `apps/web/src/copy/es.ts` (one place, easy to review).

Signature copy:

| Moment | Copy |
| --- | --- |
| App tagline | "Trae tu inventario de vuelta de la muerte." |
| Primary CTA | "Invocar inventario" |
| Uploading | "Preparando el ritual..." |
| Analyzing (rotating) | "Invocando tu inventario...", "Identificando productos...", "Leyendo etiquetas en la penumbra...", "Despertando a los fantasmas del almacén..." |
| Candidates ready | "Los productos han vuelto a la vida." |
| First save | "Tu almacén ha despertado." |
| Zero detections | "No logramos ver productos en esta foto. Prueba con más luz o más cerca." |
| Empty inventory | "Tu almacén está en silencio. Invoca tu primer producto." |

## Design tokens (dark only)

Defined once as CSS variables in `apps/web/src/styles/tokens.css`, mapped to Tailwind
theme and shadcn/ui variables. No raw hex in components.

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#07060B` | page background |
| `--surface` | `#0F0C17` | cards, panels |
| `--surface-raised` | `#171226` | popovers, drawers, hover |
| `--border` | `rgba(167,139,250,0.14)` | hairlines, card inner border |
| `--text` | `#EDE9FE` | primary text |
| `--muted` | `#8B85A3` | secondary text |
| `--violet` | `#7C3AED` | primary actions, focus ring |
| `--violet-soft` | `#A78BFA` | highlights, links, charts |
| `--ectoplasm` | `#39FF88` | success, "resurrected", saved |
| `--ember` | `#FF8A3D` | warnings, low stock |
| `--blood` | `#F43F5E` | destructive only |
| `--radius` | `14px` | cards; `10px` inputs, `999px` chips |

Contrast: body text on `--bg` and `--surface` meets WCAG AA; never place `--muted`
text under 14 px; `--ectoplasm` and `--ember` are used on dark surfaces only.

## Typography

- Display: **Fraunces** (variable, optical size), for headings and big numbers.
- Body: **Geist**. Mono: **Geist Mono** for SKU, prices and counters.
- Self-hosted via `@fontsource-variable/*` (CSP `font-src 'self'`).
- Tabular numerals for all money and counts. Money: `Intl.NumberFormat("es-CO",
  { style: "currency", currency: "COP", maximumFractionDigits: 0 })`.
- Scale: 12 / 14 / 16 / 20 / 28 / 40 / 56 px.

## Light, texture, depth

- Subtle film grain overlay (SVG noise, 4% opacity, fixed, pointer-events none).
- Radial violet glows behind hero sections; faint fog layer drifting slowly (CSS
  gradient animation, GPU cheap, paused under reduced motion).
- Glass cards: `--surface` at 80% with backdrop blur, 1 px inner border, soft shadow.
- Success glow: `--ectoplasm` box-shadow pulse, once, never looping.

## Signature moments (Motion, `motion/react`)

1. **The ritual (upload).** Drop zone styled as a summoning circle: concentric violet
   rings that breathe on hover and spin slowly while dragging. On phones a large
   button opens the camera (`capture="environment"`).
2. **The resurrection (analysis).** The photo appears in a frame; a spectral scan line
   sweeps top to bottom on loop, fog rises from the bottom edge, and the rotating
   status copy changes every 1.8 s.
3. **Rising candidates.** Cards emerge from the photo position with a staggered spring
   (80 ms stagger), fading from blur to sharp with a brief ectoplasm glow.
   Confidence shows as a chip: alta (ectoplasm), media (violet soft), baja (ember).
4. **The awakening (save).** KPI numbers count up; toast "Tu almacén ha despertado."
5. **Empty states.** Inline SVG ghost drifting over empty shelves, one clear CTA.

Durations: 150 ms micro, 250 ms standard, 450 ms hero. Easing: spring for entrances,
ease-out for exits. With `prefers-reduced-motion: reduce` every moment becomes an
instant fade (no translate, no scale, no loops). Use `useReducedMotion()`.

## Layout and navigation

- Mobile first. Bottom tab bar on phones (Almacén, Invocar, Inventario, Ajustes);
  slim left sidebar on desktop.
- Global command palette (shadcn `Command`, Ctrl+K / Cmd+K) to search products and
  jump to screens.
- Toasts with `sonner`, bottom center on phones, bottom right on desktop.
- Skeleton loaders shaped like the final content; never a lone spinner on a page.

## Screens

| Route | Name | Content |
| --- | --- | --- |
| `/` | Almacén (dashboard) | KPI cards (productos, unidades, valor del inventario, categorías), value by category chart, category distribution, low-stock list, recent resurrections |
| `/invocar` | Invocar | ritual -> resurrection -> review, one route, three steps |
| `/inventario` | Inventario | search, category chips, table on desktop and cards on phone, edit drawer, delete confirm, "Exportar CSV" |
| `/ajustes` | Ajustes | low-stock threshold |

Charts: shadcn charts (Recharts) themed with the tokens.

## Components

shadcn/ui primitives only (Radix). Any other UI library needs an ADR. Product photos
always show with a dark frame and `object-cover`; missing photo shows a ghost glyph.

## Accessibility

WCAG 2.1 AA: semantic landmarks, labels on every input, visible violet focus ring,
full keyboard path upload -> review -> save, `aria-live="polite"` on analysis status,
touch targets of at least 44 px.

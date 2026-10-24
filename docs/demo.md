# Demo script (3 minutes)

The live demo for Kiro Day Medellin 2026. Follows the north star: upload photo,
analyze with Bedrock, review, save, dashboard. Spoken lines are in Spanish (the app
language); stage directions are in English.

## Before going on stage

- Open the deployed CloudFront URL on the laptop (1440 wide, browser zoom 100%) and on
  a phone with the camera allowed. Keep both signed into nothing: there is no auth.
- Seed a believable inventory (8 to 15 products, at least one at or under the low-stock
  threshold) so the dashboard is alive before the first invocation.
- Have two real shelf photos ready on the laptop (`e2e/fixtures/images/pantry.jpg` works
  in a pinch) and one physical product on the table for the phone camera.
- Fallback without network: `pnpm --filter @ghoststock/web dev`, then open
  `http://localhost:5173/?scenario=happy` (MSW answers every call with the contract
  fixtures, including a 2.5 s analysis). Use `?scenario=zero-candidates` or
  `?scenario=model-error` only if asked about failure handling.

## Script

| Time | Screen | Do | Say |
| --- | --- | --- | --- |
| 0:00 | Almacén `/` | Let the KPIs count up; point at the glow and the grain. | "Muchos negocios tienen el inventario en la cabeza o en un cuaderno. GhostStock lo trae de vuelta de la muerte con una foto." |
| 0:20 | Almacén | Point at "Valor del inventario", the value by category bars and the ember low-stock list. | "Esto es el almacén: cuánto vale, qué se mueve y qué se está agotando." |
| 0:35 | Invocar `/invocar` | Click "Invocar"; hover the summoning circle so it breathes; drop the shelf photo. | "Invocamos inventario. Arrastro una foto al círculo..." |
| 0:50 | Preview | Click "Invocar inventario". | "La foto se reduce en el navegador y sube directo a S3 con una URL firmada." |
| 0:55 | Resurrection | Let the scan line sweep and the status rotate. | "Amazon Bedrock la analiza con un esquema estricto: solo propone nombre, categoría, descripción y marca. Nunca inventa precio, cantidad ni SKU." |
| 1:15 | Review | Cards rise with the ectoplasm glow. Point at a "Confianza baja" chip and its note. | "Los productos han vuelto a la vida. La IA dice qué tan segura está, y por qué." |
| 1:30 | Review | Fix one name, fill cantidad and precio on two cards, discard one. | "Yo corrijo lo que vio y completo lo que solo yo sé." |
| 1:50 | Review | Click "Guardar seleccionados". | |
| 1:55 | Almacén | Toast "Tu almacén ha despertado."; KPIs count up with the new totals. | "Y el almacén despierta." |
| 2:05 | Inventario | Press Ctrl+K, type a brand, open the product; edit the quantity in the drawer to show low stock. | "Todo se busca con Ctrl+K y se corrige al instante." |
| 2:25 | Inventario | Filter by a category chip, click "Exportar CSV", open it in Excel. | "Y se lleva a Excel cuando quieran." |
| 2:35 | Phone | Open the app, tap "Tomar foto", shoot the product on the table. | "En el celular es la misma experiencia, con la cámara." |
| 2:50 | Close | Back to the laptop dashboard. | "Spec-driven con Kiro, desplegado en AWS con CDK, probado con Playwright. GhostStock." |

## If something fails live

- Analysis error or throttling: the screen keeps the photo and offers "Reintentar"; say
  "la IA está muy solicitada" and retry once.
- Zero detections: the honest empty state is part of the story ("nunca inventamos
  resultados"); switch to the second photo.
- Network down: switch to the local MSW fallback above.

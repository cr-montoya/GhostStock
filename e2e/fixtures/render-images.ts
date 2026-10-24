// Renders the synthetic fixture photos in images/ (no people, no third-party licenses).
// Run from e2e/ (Node 22.18+ strips types): PW_CHANNEL=chrome node fixtures/render-images.ts
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const shelf = (items: string) => `
<body style="margin:0;width:960px;height:720px;display:flex;align-items:flex-end;justify-content:center;gap:48px;
  padding-bottom:110px;box-sizing:border-box;font-family:Arial,sans-serif;
  background:linear-gradient(#e9e4da 0 70%,#8a6a4a 70% 73%,#6b4f35 73%)">${items}</body>`;

const bag = (label: string, sub: string, color: string) => `
<div style="width:200px;height:300px;background:${color};border-radius:18px 18px 8px 8px;box-shadow:inset -18px 0 30px rgba(0,0,0,.25),0 14px 20px rgba(0,0,0,.3);
  display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center">
  <div style="background:#fffbe9;color:#3b2a1a;padding:14px 10px;width:150px;border-radius:6px">
    <div style="font-size:28px;font-weight:900;letter-spacing:1px">${label}</div>
    <div style="font-size:15px;margin-top:6px">${sub}</div>
  </div></div>`;

const bottle = (label: string, sub: string, liquid: string, cap: string, height: number) => `
<div style="display:flex;flex-direction:column;align-items:center">
  <div style="width:46px;height:30px;background:${cap};border-radius:6px 6px 0 0"></div>
  <div style="width:70px;height:60px;background:${liquid};clip-path:polygon(25% 0,75% 0,100% 100%,0 100%);opacity:.9"></div>
  <div style="width:130px;height:${height}px;background:${liquid};border-radius:16px;box-shadow:inset -14px 0 24px rgba(0,0,0,.3),0 14px 20px rgba(0,0,0,.25);
    display:flex;align-items:center;justify-content:center">
    <div style="background:#fff;width:130px;padding:12px 0;text-align:center;color:#222">
      <div style="font-size:24px;font-weight:900">${label}</div><div style="font-size:14px">${sub}</div></div></div></div>`;

const block = (label: string, sub: string, color: string, w: number, h: number) => `
<div style="width:${w}px;height:${h}px;background:${color};border-radius:10px;box-shadow:inset -12px -8px 20px rgba(0,0,0,.25),0 12px 18px rgba(0,0,0,.3);
  display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center">
  <div style="font-size:26px;font-weight:900">${label}</div><div style="font-size:14px;margin-top:4px">${sub}</div></div>`;

const scenes: Record<string, string> = {
  "pantry.jpg": shelf(
    bag("CAFÉ", "Molido · Huila · 500 g", "#8b5a2b") +
      block("PANELA", "Redonda · 1 kg", "#b7791f", 190, 150) +
      block("JABÓN", "Barra para ropa", "#2563eb", 200, 90),
  ),
  "drinks.jpg": shelf(
    bottle("COLA", "1.5 L", "#3b1d12", "#c81e1e", 300) + bottle("AGUA", "Sin gas · 600 ml", "#9ccfe8", "#1d4ed8", 220),
  ),
  "stationery.jpg": shelf(
    block("CUADERNO", "Cuadriculado · 100 hojas", "#0f766e", 240, 310) +
      `<div style="display:flex;gap:18px;align-items:flex-end">${[0, 1, 2]
        .map(() => `<div style="width:22px;height:230px;background:#111;border-radius:4px 4px 11px 11px;box-shadow:0 10px 14px rgba(0,0,0,.3)"></div>`)
        .join("")}</div>`,
  ),
  "no-products.jpg": `<body style="margin:0;width:960px;height:720px;background:
    radial-gradient(circle at 30% 40%,#cfd8dc,transparent 60%),linear-gradient(160deg,#90a4ae,#eceff1)"></body>`,
};

const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
for (const [file, html] of Object.entries(scenes)) {
  await page.setContent(`<!doctype html><html>${html}</html>`);
  await page.screenshot({ path: fileURLToPath(new URL(`images/${file}`, import.meta.url)), type: "jpeg", quality: 82 });
}
await browser.close();

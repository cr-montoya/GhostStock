import { devices } from "@playwright/test";

const { defaultBrowserType: _browser, ...pixel7 } = devices["Pixel 7"];

/** The two viewports every visual baseline is captured at. */
export const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: pixel7,
} as const;

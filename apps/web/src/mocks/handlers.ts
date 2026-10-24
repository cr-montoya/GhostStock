import { listProductsResponseFixture, settingsFixture } from "@ghoststock/contracts";
import { http, HttpResponse } from "msw";
import { currentScenario } from "./scenarios";

export const handlers = [
  http.get("/api/products", () =>
    HttpResponse.json(
      currentScenario() === "empty" ? { products: [], count: 0 } : listProductsResponseFixture,
    ),
  ),
  http.get("/api/settings", () => HttpResponse.json(settingsFixture)),
];

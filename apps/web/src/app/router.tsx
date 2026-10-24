import { createBrowserRouter, type RouteObject } from "react-router";
import { HomePage } from "@/pages/HomePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { RootLayout } from "./RootLayout";

const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [{ path: "_tokens", lazy: async () => ({ Component: (await import("@/pages/TokensPage")).TokensPage }) }]
  : [];

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [{ index: true, element: <HomePage /> }, ...devRoutes, { path: "*", element: <NotFoundPage /> }],
  },
]);

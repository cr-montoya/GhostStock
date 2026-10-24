import { createBrowserRouter, type RouteObject } from "react-router";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { InventoryPage } from "@/features/inventory/InventoryPage";
import { InvokePage } from "@/features/ritual/InvokePage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { AppShell } from "./shell/AppShell";

const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [{ path: "_tokens", lazy: async () => ({ Component: (await import("@/pages/TokensPage")).TokensPage }) }]
  : [];

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "invocar", element: <InvokePage /> },
      { path: "inventario", element: <InventoryPage /> },
      { path: "ajustes", element: <SettingsPage /> },
      ...devRoutes,
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

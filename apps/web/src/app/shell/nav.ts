import { Boxes, ScanSearch, SlidersHorizontal, Warehouse, type LucideIcon } from "lucide-react";
import { copy } from "@/copy/es";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: "/", label: copy.nav.dashboard, icon: Warehouse },
  { to: "/invocar", label: copy.nav.invoke, icon: ScanSearch },
  { to: "/inventario", label: copy.nav.inventory, icon: Boxes },
  { to: "/ajustes", label: copy.nav.settings, icon: SlidersHorizontal },
];

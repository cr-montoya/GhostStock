import { PageHeader } from "@/components/PageHeader";
import { copy } from "@/copy/es";

export function InventoryPage() {
  return <PageHeader eyebrow={copy.inventory.eyebrow} title={copy.inventory.title} description={copy.inventory.description} />;
}

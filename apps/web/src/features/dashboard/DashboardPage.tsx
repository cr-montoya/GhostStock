import { PageHeader } from "@/components/PageHeader";
import { copy } from "@/copy/es";

export function DashboardPage() {
  return <PageHeader eyebrow={copy.dashboard.eyebrow} title={copy.dashboard.title} description={copy.brand.tagline} />;
}

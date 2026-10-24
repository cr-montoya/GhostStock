import { PageHeader } from "@/components/PageHeader";
import { copy } from "@/copy/es";

export function SettingsPage() {
  return <PageHeader eyebrow={copy.settings.eyebrow} title={copy.settings.title} description={copy.settings.description} />;
}

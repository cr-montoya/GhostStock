import { PageHeader } from "@/components/PageHeader";
import { copy } from "@/copy/es";

export function InvokePage() {
  return <PageHeader eyebrow={copy.ritual.eyebrow} title={copy.ritual.title} description={copy.ritual.description} />;
}

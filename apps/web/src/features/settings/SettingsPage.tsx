import { SettingsSchema, isLowStock, type Settings } from "@ghoststock/contracts";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { toClientError } from "@/api/client";
import { useProducts, useSettings, useUpdateSettings } from "@/api/queries";
import { ErrorState } from "@/components/ErrorState";
import { Field } from "@/components/Field";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { copy } from "@/copy/es";
import { parseInteger } from "@/features/review/reviewModel";

export function SettingsPage() {
  const settings = useSettings();
  const header = (
    <PageHeader eyebrow={copy.settings.eyebrow} title={copy.settings.title} description={copy.settings.description} />
  );

  if (settings.isPending) {
    return (
      <>
        {header}
        <div role="status" aria-busy="true" aria-label={copy.common.loading} className="glass max-w-xl rounded-xl p-6">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-3 h-11 w-full" />
          <Skeleton className="mt-6 h-11 w-36" />
        </div>
      </>
    );
  }

  if (settings.isError) {
    return (
      <>
        {header}
        <ErrorState title={copy.settings.errorTitle} error={settings.error} onRetry={() => void settings.refetch()} />
      </>
    );
  }

  return (
    <>
      {header}
      <ThresholdForm key={settings.data.lowStockThreshold} saved={settings.data} />
    </>
  );
}

function ThresholdForm({ saved }: { saved: Settings }) {
  const [value, setValue] = useState(String(saved.lowStockThreshold));
  const [error, setError] = useState<string>();
  const products = useProducts();
  const update = useUpdateSettings();

  const parsed = parseInteger(value);
  const candidate = parsed === undefined ? undefined : SettingsSchema.safeParse({ lowStockThreshold: parsed });
  const previewThreshold = candidate?.success ? candidate.data.lowStockThreshold : undefined;
  const affected =
    previewThreshold !== undefined && products.data
      ? products.data.filter((p) => isLowStock(p, previewThreshold)).length
      : undefined;
  const dirty = previewThreshold !== saved.lowStockThreshold;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!candidate?.success) return setError(copy.settings.thresholdError);
    setError(undefined);
    update.mutate(candidate.data, {
      onSuccess: () => toast.success(copy.settings.saved),
      onError: (e) => toast.error(copy.settings.saveFailed, { description: copy.errors[toClientError(e).code] }),
    });
  }

  return (
    <form onSubmit={submit} noValidate className="glass flex max-w-xl flex-col gap-5 rounded-xl p-5 md:p-6">
      <Field label={copy.settings.threshold} error={error} hint={copy.settings.thresholdHint}>
        {(props) => (
          <Input
            {...props}
            inputMode="numeric"
            autoComplete="off"
            className="max-w-40 font-mono text-lg tabular"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        )}
      </Field>
      {affected !== undefined && (
        <p className="rounded-md border border-ember/25 bg-ember/5 px-3 py-2 text-sm text-ember" aria-live="polite">
          {copy.settings.preview(affected)}
        </p>
      )}
      <div>
        <Button type="submit" disabled={update.isPending || !dirty}>
          {update.isPending ? copy.common.saving : copy.settings.save}
        </Button>
      </div>
    </form>
  );
}

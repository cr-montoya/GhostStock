import { ScanSearch } from "lucide-react";
import { GhostEmptyState } from "@/components/brand/GhostEmptyState";
import { Logo } from "@/components/brand/Logo";
import { Field } from "@/components/Field";
import { PageHeader } from "@/components/PageHeader";
import { ProductPhoto } from "@/components/ProductPhoto";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { copy } from "@/copy/es";
import { formatCop } from "@/lib/format";

const SWATCHES = [
  ["--bg", "bg-bg"],
  ["--surface", "bg-surface"],
  ["--surface-raised", "bg-surface-raised"],
  ["--text", "bg-text"],
  ["--muted", "bg-muted-foreground"],
  ["--violet", "bg-violet"],
  ["--violet-soft", "bg-violet-soft"],
  ["--ectoplasm", "bg-ectoplasm"],
  ["--ember", "bg-ember"],
  ["--blood", "bg-blood"],
] as const;

const SCALE = [
  ["text-3xl", "56"],
  ["text-2xl", "40"],
  ["text-xl", "28"],
  ["text-lg", "20"],
  ["text-base", "16"],
  ["text-sm", "14"],
  ["text-xs", "12"],
] as const;

/** Dev-only showcase of the design system, captured by the visual baseline (task 2). */
export function TokensPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:px-10">
      <Logo className="mb-10" />
      <PageHeader eyebrow={copy.showcase.eyebrow} title={copy.showcase.title} description={copy.showcase.description} />

      <section aria-labelledby="palette" className="mb-12">
        <h2 id="palette" className="mb-4 text-xl">
          {copy.showcase.palette}
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {SWATCHES.map(([token, className]) => (
            <li key={token} className="glass rounded-lg p-2">
              <div className={`h-16 rounded-md border border-border ${className}`} />
              <p className="mt-2 px-1 font-mono text-xs text-muted-foreground">{token}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="type" className="mb-12">
        <h2 id="type" className="mb-4 text-xl">
          {copy.showcase.type}
        </h2>
        <div className="glass flex flex-col gap-3 rounded-xl p-6">
          {SCALE.map(([size, px]) => (
            <p key={size} className={`font-display ${size} truncate`}>
              <span className="mr-4 inline-block w-10 font-mono text-xs text-muted-foreground">{px}</span>
              {copy.brand.tagline}
            </p>
          ))}
          <p className="mt-4 text-base">{copy.showcase.sampleBody}</p>
          <p className="font-mono text-lg tabular text-violet-soft">{formatCop(1_234_567)}</p>
        </div>
      </section>

      <section aria-labelledby="components" className="mb-12">
        <h2 id="components" className="mb-4 text-xl">
          {copy.showcase.components}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{copy.showcase.sample}</CardTitle>
              <CardDescription>{copy.showcase.sampleBody}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="ectoplasm">{copy.confidence.high}</Badge>
                <Badge variant="violet">{copy.confidence.medium}</Badge>
                <Badge variant="ember">{copy.confidence.low}</Badge>
                <Badge variant="blood">{copy.common.lowStock}</Badge>
              </div>
              <Field label={copy.showcase.inputLabel}>{(props) => <Input {...props} defaultValue={copy.showcase.sample} />}</Field>
              <div className="flex flex-wrap gap-3">
                <Button>
                  <ScanSearch aria-hidden="true" />
                  {copy.cta.invoke}
                </Button>
                <Button variant="outline">{copy.common.otherPhoto}</Button>
                <Button variant="ghost">{copy.common.cancel}</Button>
              </div>
              <div className="flex items-center gap-3">
                <ProductPhoto src={null} alt={copy.common.noPhoto} className="size-16" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            </CardContent>
          </Card>
          <GhostEmptyState title={copy.showcase.emptyTitle} action={<Button>{copy.cta.invoke}</Button>} />
        </div>
      </section>
    </main>
  );
}

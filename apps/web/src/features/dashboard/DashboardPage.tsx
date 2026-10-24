import { computeInventoryStats } from "@ghoststock/contracts";
import { Boxes, Coins, Layers, Package, ScanSearch } from "lucide-react";
import { Link } from "react-router";
import { useProducts, useSettings } from "@/api/queries";
import { ErrorState } from "@/components/ErrorState";
import { GhostEmptyState } from "@/components/brand/GhostEmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { copy } from "@/copy/es";
import { formatCop, formatNumber } from "@/lib/format";
import { CategoryDonut, ValueByCategoryChart } from "./charts";
import { KpiCard } from "./KpiCard";
import { LowStockList } from "./LowStockList";
import { RecentGrid } from "./RecentGrid";

const RECENT_COUNT = 6;

function InvokeButton() {
  return (
    <Button asChild size="lg">
      <Link to="/invocar">
        <ScanSearch aria-hidden="true" />
        {copy.cta.invoke}
      </Link>
    </Button>
  );
}

export function DashboardPage() {
  const products = useProducts();
  const settings = useSettings();

  const header = (
    <PageHeader
      eyebrow={copy.dashboard.eyebrow}
      title={copy.dashboard.title}
      description={copy.brand.tagline}
      actions={<InvokeButton />}
    />
  );

  if (products.isPending || settings.isPending) {
    return (
      <>
        {header}
        <DashboardSkeleton />
      </>
    );
  }

  if (products.isError || settings.isError) {
    return (
      <>
        {header}
        <ErrorState
          title={copy.dashboard.errorTitle}
          error={products.error ?? settings.error}
          onRetry={() => {
            void products.refetch();
            void settings.refetch();
          }}
        />
      </>
    );
  }

  if (products.data.length === 0) {
    return (
      <>
        <PageHeader eyebrow={copy.dashboard.eyebrow} title={copy.dashboard.title} description={copy.brand.tagline} />
        <GhostEmptyState title={copy.dashboard.empty.title} body={copy.dashboard.empty.body} action={<InvokeButton />} />
      </>
    );
  }

  const threshold = settings.data.lowStockThreshold;
  const stats = computeInventoryStats(products.data, threshold);

  return (
    <>
      {header}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard label={copy.dashboard.kpis.products} value={stats.productCount} format={formatNumber} icon={Package} />
        <KpiCard label={copy.dashboard.kpis.units} value={stats.unitCount} format={formatNumber} icon={Boxes} />
        <KpiCard
          label={copy.dashboard.kpis.value}
          value={stats.inventoryValueCop}
          format={formatCop}
          icon={Coins}
          highlight
        />
        <KpiCard label={copy.dashboard.kpis.categories} value={stats.categoryCount} format={formatNumber} icon={Layers} />
      </div>

      <div className="mt-4 grid gap-4 md:mt-6 lg:grid-cols-5">
        <Card role="region" aria-labelledby="dash-value" className="lg:col-span-3">
          <CardHeader>
            <CardTitle id="dash-value">{copy.dashboard.valueByCategory}</CardTitle>
            <CardDescription>{copy.dashboard.valueByCategoryHint}</CardDescription>
          </CardHeader>
          <CardContent>
            <ValueByCategoryChart data={stats.byCategory} />
          </CardContent>
        </Card>
        <Card role="region" aria-labelledby="dash-distribution" className="lg:col-span-2">
          <CardHeader>
            <CardTitle id="dash-distribution">{copy.dashboard.distribution}</CardTitle>
            <CardDescription>{copy.dashboard.distributionHint}</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryDonut data={stats.byCategory} total={stats.productCount} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:mt-6 lg:grid-cols-5">
        <Card role="region" aria-labelledby="dash-low" className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span id="dash-low">{copy.dashboard.lowStock}</span>
              {stats.lowStock.length > 0 && (
                <span className="rounded-full bg-ember/15 px-2 py-0.5 font-mono text-xs tabular text-ember">
                  {stats.lowStock.length}
                </span>
              )}
            </CardTitle>
            <CardDescription>{copy.dashboard.lowStockHint(threshold)}</CardDescription>
          </CardHeader>
          <CardContent>
            <LowStockList products={stats.lowStock} />
          </CardContent>
        </Card>
        <Card role="region" aria-labelledby="dash-recent" className="lg:col-span-3">
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle id="dash-recent">{copy.dashboard.recent}</CardTitle>
              <CardDescription>{copy.dashboard.recentHint}</CardDescription>
            </div>
            <Button asChild variant="link" size="sm" className="-mr-3">
              <Link to="/inventario">{copy.dashboard.seeAll}</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <RecentGrid products={products.data.slice(0, RECENT_COUNT)} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label={copy.common.loading}>
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="glass rounded-lg p-4 md:p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-9 w-32" />
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:mt-6 lg:grid-cols-5">
        <div className="glass rounded-lg p-5 lg:col-span-3">
          <Skeleton className="h-5 w-40" />
          <div className="mt-6 flex flex-col gap-3">
            {[90, 70, 55, 40, 25].map((w) => (
              <Skeleton key={w} className="h-7" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
        <div className="glass flex items-center gap-6 rounded-lg p-5 lg:col-span-2">
          <Skeleton className="size-40 rounded-full" />
          <div className="flex flex-1 flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-4" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

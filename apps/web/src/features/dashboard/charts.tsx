import type { CategoryStats } from "@ghoststock/contracts";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useReducedMotion } from "motion/react";
import { copy } from "@/copy/es";
import { formatCompactCop, formatCop, formatNumber } from "@/lib/format";

const PALETTE = [
  "var(--violet-soft)",
  "var(--violet)",
  "var(--ectoplasm)",
  "var(--ember)",
  "var(--muted)",
  "var(--text)",
];

function GlassTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload: CategoryStats }> }) {
  const entry = payload?.[0]?.payload;
  if (!active || !entry) return null;
  return (
    <div className="glass rounded-md px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-text">{entry.label}</p>
      <p className="mt-1 font-mono tabular text-violet-soft">{formatCop(entry.valueCop)}</p>
      <p className="text-muted-foreground">
        {copy.dashboard.productsCount(entry.productCount)} · {copy.common.units(entry.unitCount)}
      </p>
    </div>
  );
}

/** Horizontal bars, value per category (COP). */
export function ValueByCategoryChart({ data }: { data: CategoryStats[] }) {
  const reduce = useReducedMotion();
  const height = Math.max(160, data.length * 44);
  return (
    <figure aria-label={copy.dashboard.valueByCategory}>
      <div style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 64, top: 0, bottom: 0 }} barCategoryGap={10}>
            <defs>
              <linearGradient id="gs-bar" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="var(--violet)" stopOpacity={0.55} />
                <stop offset="1" stopColor="var(--violet-soft)" />
              </linearGradient>
            </defs>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              width={96}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted)", fontSize: 13 }}
            />
            <Tooltip cursor={{ fill: "var(--surface-raised)", opacity: 0.6 }} content={<GlassTooltip />} />
            <Bar
              dataKey="valueCop"
              fill="url(#gs-bar)"
              radius={[0, 8, 8, 0]}
              isAnimationActive={!reduce}
              animationDuration={900}
              label={{
                position: "right",
                fill: "var(--text)",
                fontSize: 12,
                fontWeight: 600,
                formatter: (value: unknown) => formatCompactCop(Number(value)),
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        <ul>
          {data.map((entry) => (
            <li key={entry.category}>
              {entry.label}: {formatCop(entry.valueCop)}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

/** Donut of product count per category with a legend. */
export function CategoryDonut({ data, total }: { data: CategoryStats[]; total: number }) {
  const reduce = useReducedMotion();
  return (
    <figure aria-label={copy.dashboard.distribution} className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative size-44 shrink-0" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="productCount"
              nameKey="label"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={3}
              stroke="var(--surface)"
              strokeWidth={2}
              isAnimationActive={!reduce}
              animationDuration={900}
            >
              {data.map((entry, index) => (
                <Cell key={entry.category} fill={PALETTE[index % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip content={<GlassTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-display text-xl tabular">{formatNumber(total)}</p>
            <p className="text-xs text-muted-foreground">{copy.dashboard.kpis.products}</p>
          </div>
        </div>
      </div>
      <figcaption className="w-full">
        <ul className="grid gap-2">
          {data.map((entry, index) => (
            <li key={entry.category} className="flex items-center gap-3 text-sm">
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: PALETTE[index % PALETTE.length] }}
              />
              <span className="flex-1 text-text/90">{entry.label}</span>
              <span className="font-mono tabular text-muted-foreground">{formatNumber(entry.productCount)}</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

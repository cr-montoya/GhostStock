import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-border-strong bg-surface-raised text-text",
        violet: "border-violet-soft/30 bg-violet-soft/10 text-violet-soft",
        ectoplasm: "border-ectoplasm/30 bg-ectoplasm/10 text-ectoplasm",
        ember: "border-ember/35 bg-ember/10 text-ember",
        blood: "border-blood/35 bg-blood/10 text-blood",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

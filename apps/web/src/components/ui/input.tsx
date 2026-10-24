import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full min-w-0 rounded-md border border-input bg-bg/60 px-3 py-2 text-base text-text shadow-[inset_0_1px_2px_var(--ink)] transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-muted-foreground/70 focus-visible:border-violet focus-visible:shadow-[0_0_0_3px_var(--violet-glow)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-blood aria-invalid:shadow-[0_0_0_3px_color-mix(in_oklab,var(--blood)_25%,transparent)] md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Input };

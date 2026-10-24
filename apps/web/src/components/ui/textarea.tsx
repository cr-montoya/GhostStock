import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-20 w-full rounded-md border border-input bg-bg/60 px-3 py-2 text-base text-text shadow-[inset_0_1px_2px_var(--ink)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/70 focus-visible:border-violet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet focus-visible:shadow-[0_0_0_3px_var(--violet-glow)] aria-invalid:border-blood md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };

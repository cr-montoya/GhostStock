import { CheckIcon } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer grid size-5 shrink-0 place-items-center rounded-[6px] border border-border-strong bg-bg/60 outline-none transition-[background-color,border-color,box-shadow] duration-150 focus-visible:shadow-[0_0_0_3px_var(--violet-glow)] data-[state=checked]:border-violet data-[state=checked]:bg-violet data-[state=checked]:text-white disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <CheckIcon className="size-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };

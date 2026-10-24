import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;
const SelectValue = SelectPrimitive.Value;

function SelectTrigger({ className, children, ...props }: ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex h-11 w-full items-center justify-between gap-2 rounded-md border border-input bg-bg/60 px-3 text-base text-text shadow-[inset_0_1px_2px_var(--ink)] outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-violet focus-visible:shadow-[0_0_0_3px_var(--violet-glow)] aria-invalid:border-blood data-[placeholder]:text-muted-foreground md:text-sm [&>span]:line-clamp-1",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-60" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        className={cn(
          "relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] overflow-y-auto rounded-md border border-border-strong bg-surface-raised text-text shadow-[0_24px_48px_-12px_var(--ink)] data-[state=open]:animate-in data-[state=open]:fade-in-0",
          position === "popper" && "w-full min-w-(--radix-select-trigger-width) data-[side=bottom]:translate-y-1",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({ className, children, ...props }: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex min-h-10 w-full cursor-default items-center rounded-sm py-2 pl-3 pr-8 text-sm outline-none select-none focus:bg-violet/20 focus:text-text data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4 text-violet-soft" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };

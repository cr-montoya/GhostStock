import { Command as CommandIcon } from "lucide-react";
import { NavLink } from "react-router";
import { Logo } from "@/components/brand/Logo";
import { copy } from "@/copy/es";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav";

export function Sidebar({ onOpenCommand }: { onOpenCommand: () => void }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface/50 backdrop-blur-xl md:flex">
      <div className="flex h-20 items-center px-6">
        <NavLink to="/" aria-label={copy.brand.name} className="rounded-md">
          <Logo />
        </NavLink>
      </div>

      <div className="px-4">
        <button
          type="button"
          onClick={onOpenCommand}
          className="group flex h-11 w-full items-center gap-3 rounded-md border border-border bg-bg/50 px-3 text-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-text"
        >
          <CommandIcon className="size-4 text-violet-soft" aria-hidden="true" />
          <span className="flex-1 text-left">{copy.nav.commandHint}</span>
          <kbd className="rounded border border-border bg-surface-raised px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            Ctrl K
          </kbd>
          <span className="sr-only">{copy.command.open}</span>
        </button>
      </div>

      <nav aria-label={copy.nav.label} className="mt-6 flex-1 px-3">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "relative flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150",
                    isActive
                      ? "bg-violet/12 text-text shadow-[inset_0_0_0_1px_var(--border-strong)]"
                      : "text-muted-foreground hover:bg-surface-raised hover:text-text",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute -left-3 top-2 h-7 w-1 rounded-r-full bg-violet-soft shadow-[0_0_16px_var(--violet-glow)]"
                      />
                    )}
                    <Icon className={cn("size-[18px]", isActive && "text-violet-soft")} aria-hidden="true" />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <p className="px-6 pb-6 font-display text-sm italic leading-snug text-muted-foreground">{copy.brand.tagline}</p>
    </aside>
  );
}

import { NavLink } from "react-router";
import { copy } from "@/copy/es";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav";

/** Thumb navigation for phones (under 768 px). */
export function TabBar() {
  return (
    <nav
      aria-label={copy.nav.label}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="grid grid-cols-4">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  isActive ? "text-text" : "text-muted-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute top-0 h-0.5 w-10 rounded-b-full bg-violet-soft shadow-[0_0_14px_var(--violet-glow)]"
                    />
                  )}
                  <Icon className={cn("size-5", isActive && "text-violet-soft")} aria-hidden="true" />
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

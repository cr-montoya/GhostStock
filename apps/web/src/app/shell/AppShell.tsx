import { Search } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Link, useLocation, useOutlet } from "react-router";
import { Atmosphere } from "@/components/brand/Atmosphere";
import { Logo } from "@/components/brand/Logo";
import { Toaster } from "@/components/ui/sonner";
import { copy } from "@/copy/es";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { CommandPalette } from "./CommandPalette";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";

export function AppShell() {
  const [commandOpen, setCommandOpen] = useState(false);
  const location = useLocation();
  const outlet = useOutlet();
  const reduce = useReducedMotion();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Every screen starts at the top, so the dashboard KPIs are in view when a save lands.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <a
        href="#contenido"
        className="sr-only z-[70] rounded-md bg-violet px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {copy.nav.skipToContent}
      </a>
      <Atmosphere />
      <Sidebar onOpenCommand={() => setCommandOpen(true)} />

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-bg/70 px-4 backdrop-blur-xl md:hidden">
        <Link to="/" aria-label={copy.brand.name} className="rounded-md">
          <Logo />
        </Link>
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="grid size-11 place-items-center rounded-md border border-border bg-surface/60 text-muted-foreground"
        >
          <Search className="size-5" aria-hidden="true" />
          <span className="sr-only">{copy.command.open}</span>
        </button>
      </header>

      <main
        id="contenido"
        tabIndex={-1}
        className="relative z-10 px-4 pb-28 pt-6 outline-none md:ml-64 md:px-10 md:pb-16 md:pt-10"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: reduce ? 0.15 : 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto w-full max-w-6xl"
          >
            {outlet}
          </motion.div>
        </AnimatePresence>
      </main>

      <TabBar />
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <Toaster position={isDesktop ? "bottom-right" : "bottom-center"} offset={24} mobileOffset={{ bottom: 88 }} />
    </div>
  );
}

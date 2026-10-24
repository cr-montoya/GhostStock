import { Outlet } from "react-router";
import { Atmosphere } from "@/components/brand/Atmosphere";

/** Atmosphere behind every screen; the navigation shell arrives with task 3. */
export function RootLayout() {
  return (
    <div className="relative min-h-dvh">
      <Atmosphere />
      <div className="relative z-10">
        <Outlet />
      </div>
    </div>
  );
}

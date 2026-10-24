import { Logo } from "@/components/brand/Logo";
import { copy } from "@/copy/es";

export function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6">
      <Logo className="mb-8" compact />
      <h1 className="text-3xl font-medium text-glow">{copy.brand.name}</h1>
      <p className="mt-3 font-display text-lg italic text-muted-foreground">{copy.brand.tagline}</p>
    </main>
  );
}

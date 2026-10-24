import { copy } from "@/copy/es";

export function HomePage() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-4xl">{copy.brand.name}</h1>
      <p>{copy.brand.tagline}</p>
    </main>
  );
}

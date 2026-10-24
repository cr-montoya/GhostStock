import { Link } from "react-router";
import { copy } from "@/copy/es";

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-4xl">{copy.notFound.title}</h1>
      <p>{copy.notFound.body}</p>
      <Link to="/">{copy.notFound.back}</Link>
    </main>
  );
}

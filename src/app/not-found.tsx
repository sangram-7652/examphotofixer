import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Page not found</h1>
      <p className="mt-4 text-muted">
        <Link href="/tools" className="underline">
          Browse all tools
        </Link>
      </p>
    </div>
  );
}

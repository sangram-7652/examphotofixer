import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-4 text-muted">
        <Link href="/tools" className="underline">
          Browse all tools
        </Link>
      </p>
    </div>
  );
}

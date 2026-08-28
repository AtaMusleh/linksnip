import Link from 'next/link';

export const metadata = {
  title: 'Link not found · LinkSnip',
};

export default function LinkNotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">This link doesn&apos;t exist</h1>
      <p className="text-muted-foreground text-sm">
        The short link you followed is wrong, was deleted, or never existed.
      </p>
      <Link href="/" className="text-sm underline underline-offset-4">
        Create a new short link
      </Link>
    </main>
  );
}

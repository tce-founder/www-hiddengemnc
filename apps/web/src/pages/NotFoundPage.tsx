import { Link } from 'react-router';
import { Seo } from '@/components/Seo';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <>
      <Seo title="Page not found" noindex />
      <section className="mx-auto flex max-w-xl flex-col items-center px-6 py-32 text-center">
        <p className="text-sm font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          404
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Page not found</h1>
        <p className="mt-4 text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <Button asChild className="mt-8">
          <Link to="/">Back to home</Link>
        </Button>
      </section>
    </>
  );
}

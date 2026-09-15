import { Seo } from '@/components/Seo';
import { PageHeader } from '@/components/sections/PageHeader';

export default function TermsPage() {
  return (
    <>
      <Seo
        title="Terms of Use"
        description="Terms of use for the Hidden Gem NC website."
        path="/terms"
      />
      <PageHeader title="Terms of Use" />
      <section className="mx-auto max-w-3xl space-y-4 px-6 py-16 text-muted-foreground">
        <p className="rounded-md border border-dashed p-4 text-sm">
          <strong className="text-foreground">Placeholder.</strong> Replace with the terms of use
          approved by counsel before launch.
        </p>
      </section>
    </>
  );
}

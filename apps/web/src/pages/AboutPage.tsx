import { Seo } from '@/components/Seo';
import { PageHeader } from '@/components/sections/PageHeader';

export default function AboutPage() {
  return (
    <>
      <Seo
        title="About"
        description="Placeholder: a one-sentence description of the About page for search results."
        path="/about"
      />
      <PageHeader eyebrow="About" title="About Hidden Gem NC">
        Placeholder introduction — the story in one or two sentences.
      </PageHeader>

      <section className="mx-auto max-w-3xl space-y-6 px-6 py-16 text-lg leading-relaxed text-muted-foreground">
        <p>
          Placeholder body copy. Replace with the company story, mission, and what makes the
          approach different.
        </p>
        <p>
          A second paragraph for team, history, or values. Add images to <code>src/assets</code> and
          import them here.
        </p>
      </section>
    </>
  );
}

import { ArrowRight, ChartColumn, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import { Seo } from '@/components/Seo';
import { Button } from '@/components/ui/button';
import { site } from '@/config/site';
import { socialProfiles } from '@/lib/social';

// Tells search engines which social profiles are the business's.
const sameAs = socialProfiles(site.social).map((profile) => profile.url);

// PLACEHOLDER content — the structure is here to be redesigned.
const features = [
  {
    icon: Sparkles,
    title: 'Feature one',
    body: 'Placeholder. A short, concrete sentence about the first thing Hidden Gem NC does well.',
  },
  {
    icon: ChartColumn,
    title: 'Feature two',
    body: 'Placeholder. What a customer gets from it, in their words rather than ours.',
  },
  {
    icon: ShieldCheck,
    title: 'Feature three',
    body: 'Placeholder. A proof point — a number, a customer, a certification.',
  },
];

export default function HomePage() {
  return (
    <>
      <Seo
        path="/"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: site.name,
          url: site.url,
          ...(sameAs.length > 0 ? { sameAs } : {}),
        }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -right-40 size-[32rem] rounded-full bg-accent/20 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
          <p className="mb-5 text-xs font-semibold tracking-[0.2em] text-accent uppercase">
            Placeholder eyebrow
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold md:text-6xl">
            A headline that says what Hidden Gem NC does.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-primary-foreground/75">
            Placeholder supporting copy: who it is for, the outcome they get, and why now. Keep it
            to two sentences.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="accent">
              <Link to="/book">
                Book a time <ArrowRight />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Link to="/about">Learn more</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold md:text-4xl">Section heading placeholder</h2>
          <p className="mt-4 text-muted-foreground">One line introducing the three points below.</p>
        </div>
        <ul className="mt-12 grid gap-6 md:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-xl border bg-card p-6 shadow-xs">
              <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-accent/15 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Call to action */}
      <section className="border-t bg-secondary/50">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-16 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold md:text-3xl">Call-to-action placeholder</h2>
            <p className="mt-2 text-muted-foreground">
              One sentence on what happens when they reach out.
            </p>
          </div>
          <Button asChild size="lg">
            <Link to="/contact">Contact us</Link>
          </Button>
        </div>
      </section>
    </>
  );
}

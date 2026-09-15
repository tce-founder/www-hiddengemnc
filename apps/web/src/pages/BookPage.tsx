import { CalendarClock } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Seo } from '@/components/Seo';
import { PageHeader } from '@/components/sections/PageHeader';
import { Button } from '@/components/ui/button';
import { site } from '@/config/site';
import { trackEvent } from '@/lib/analytics';
import { calendlyEmbedUrl, isEventScheduled, loadCalendly } from '@/lib/calendly';

const bookingUrl = calendlyEmbedUrl(site.calendlyUrl);

export default function BookPage() {
  return (
    <>
      <Seo title="Book" description="Placeholder: book a time with Hidden Gem NC." path="/book" />
      <PageHeader eyebrow="Book" title="Book a time">
        Placeholder: what visitors are booking, how long it takes, and what happens next.
      </PageHeader>

      <section className="mx-auto max-w-4xl px-6 py-12">
        {bookingUrl ? <CalendlyInline url={bookingUrl} /> : <BookingComingSoon />}
      </section>
    </>
  );
}

/**
 * Calendly's inline widget. The prerendered page has only the empty frame and
 * the fallback link; Calendly's script fills the frame in the browser.
 */
function CalendlyInline({ url }: { url: string }) {
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadCalendly()
      .then((calendly) => {
        if (cancelled || !frame.current) return;
        frame.current.replaceChildren();
        calendly.initInlineWidget({ url, parentElement: frame.current });
      })
      // The link below still works if the widget can't load.
      .catch(() => undefined);

    // Calendly posts this when a booking is confirmed. Nothing personal goes to GA4.
    const onMessage = (event: MessageEvent) => {
      if (isEventScheduled(event)) trackEvent('book_appointment', { method: 'calendly' });
    };
    window.addEventListener('message', onMessage);
    return () => {
      cancelled = true;
      window.removeEventListener('message', onMessage);
    };
  }, [url]);

  return (
    <div>
      <div
        ref={frame}
        aria-label="Booking calendar"
        className="h-[700px] min-w-[320px] overflow-hidden rounded-xl border bg-card"
      />
      <p className="mt-3 text-sm text-muted-foreground">
        Calendar not showing?{' '}
        <a className="underline" href={url} target="_blank" rel="noopener noreferrer">
          Book on Calendly
        </a>
        .
      </p>
    </div>
  );
}

function BookingComingSoon() {
  return (
    <div className="rounded-xl border bg-card p-8 text-center shadow-xs">
      <CalendarClock className="mx-auto size-10 text-primary" aria-hidden="true" />
      <h2 className="mt-4 text-2xl font-semibold">Online booking opens soon</h2>
      <p className="mt-2 text-muted-foreground">
        In the meantime, send us a message and we&apos;ll find a time.
      </p>
      <Button asChild className="mt-6">
        <Link to="/contact">Contact us</Link>
      </Button>
    </div>
  );
}

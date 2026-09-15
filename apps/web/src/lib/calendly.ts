/**
 * Calendly booking widget for /book. Calendly's script loads only on that
 * page, and only once site.calendlyUrl is set.
 */

interface CalendlyApi {
  initInlineWidget(options: { url: string; parentElement: HTMLElement }): void;
}

declare global {
  interface Window {
    Calendly?: CalendlyApi;
  }
}

const CALENDLY_ORIGIN = 'https://calendly.com';
const WIDGET_SCRIPT = 'https://assets.calendly.com/assets/external/widget.js';

/** The link to embed, or undefined unless it's an https scheduling page on calendly.com. */
export function calendlyEmbedUrl(url: string | undefined): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    return parsed.origin === CALENDLY_ORIGIN && parsed.pathname.length > 1
      ? parsed.href
      : undefined;
  } catch {
    return undefined;
  }
}

/** True for the message Calendly's widget posts when a visitor confirms a booking. */
export function isEventScheduled(event: { origin: string; data: unknown }): boolean {
  const { data } = event;
  return (
    event.origin === CALENDLY_ORIGIN &&
    typeof data === 'object' &&
    data !== null &&
    (data as { event?: unknown }).event === 'calendly.event_scheduled'
  );
}

/** Loads Calendly's widget script once; resolves when its API is ready. */
export function loadCalendly(): Promise<CalendlyApi> {
  if (window.Calendly) return Promise.resolve(window.Calendly);

  return new Promise((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(`script[src="${WIDGET_SCRIPT}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = WIDGET_SCRIPT;
      script.async = true;
      document.head.appendChild(script);
    }
    const failed = () => reject(new Error('The Calendly widget failed to load'));
    script.addEventListener('load', () => (window.Calendly ? resolve(window.Calendly) : failed()), {
      once: true,
    });
    script.addEventListener('error', failed, { once: true });
  });
}

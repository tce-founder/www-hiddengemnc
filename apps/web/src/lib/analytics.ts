/**
 * Google Analytics 4 for the deployed sites. gtag.js loads when the build has a
 * measurement ID (VITE_GA_MEASUREMENT_ID, from the GA_MEASUREMENT_ID variable on
 * each GitHub Environment) and VITE_SITE_ENV is dev or prod. Dev and prod report
 * to separate GA4 properties; local runs and the prerender never send data.
 *
 * Page views: GA4's enhanced measurement (on by default for web streams)
 * records the first load and every client-side navigation from browser-history
 * changes, so routes aren't tracked by hand here. Ads features are off.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const MEASUREMENT_ID = /^G-[A-Z0-9]{4,}$/;
const DEPLOYED_ENVIRONMENTS = new Set(['dev', 'prod']);

/** The measurement ID to use, or undefined when analytics should stay off. */
export function resolveMeasurementId(
  id: string | undefined,
  siteEnv: string | undefined,
): string | undefined {
  const trimmed = id?.trim();
  return siteEnv && DEPLOYED_ENVIRONMENTS.has(siteEnv) && trimmed && MEASUREMENT_ID.test(trimmed)
    ? trimmed
    : undefined;
}

/** Call once in the browser, before rendering. */
export function initAnalytics(
  id = resolveMeasurementId(import.meta.env.VITE_GA_MEASUREMENT_ID, import.meta.env.VITE_SITE_ENV),
): void {
  if (!id || typeof window === 'undefined' || window.gtag) return;

  const dataLayer = (window.dataLayer = window.dataLayer ?? []);
  window.gtag = function gtag() {
    // gtag.js expects the arguments object itself, not a rest-parameter array.
    // eslint-disable-next-line prefer-rest-params
    dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', id, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
}

/** Records a GA4 event; a no-op when analytics isn't loaded. Never pass personal data. */
export function trackEvent(name: string, params?: Record<string, string | number | boolean>): void {
  if (typeof window !== 'undefined') window.gtag?.('event', name, params);
}

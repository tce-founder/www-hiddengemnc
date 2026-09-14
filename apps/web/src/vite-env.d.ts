/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Canonical origin, e.g. https://hiddengemnc.com. */
  readonly VITE_SITE_URL?: string;
  /** local | dev | prod — anything but prod is marked noindex. */
  readonly VITE_SITE_ENV?: string;
  /** API base path. Defaults to the same-origin `/api`. */
  readonly VITE_API_BASE_URL?: string;
  /** reCAPTCHA v3 site key (public). */
  readonly VITE_RECAPTCHA_SITE_KEY?: string;
  /** GA4 measurement ID (public), e.g. G-XXXXXXXXXX. Loads only when VITE_SITE_ENV is dev or prod. */
  readonly VITE_GA_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

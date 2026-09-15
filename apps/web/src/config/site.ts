/**
 * Site-wide settings: name, navigation, social links, booking and default SEO.
 * Change copy here rather than hunting through components.
 */
export const site = {
  name: 'Hidden Gem NC',
  /** Shown after the name on the homepage title and as the default description. */
  tagline: 'Placeholder tagline — one line on what Hidden Gem NC does',
  description:
    'Placeholder description. Replace with one or two sentences (about 150 characters) that say what Hidden Gem NC does and who it is for.',
  /** Canonical origin. The build sets VITE_SITE_URL per environment. */
  url: (import.meta.env.VITE_SITE_URL ?? 'https://hiddengemnc.com').replace(/\/+$/, ''),
  /** Only production is indexable; dev and local get noindex. */
  indexable: import.meta.env.VITE_SITE_ENV === 'prod',
  /** Absolute URL of the default 1200×630 social image, e.g. `${url}/og-image.png`. */
  defaultOgImage: undefined as string | undefined,
  /**
   * Social profiles, as full https links on each network's own site, e.g.
   * 'https://www.instagram.com/hiddengemnc'. Leave one empty to hide it. They
   * appear in the footer and tell search engines which profiles are the
   * business's (schema.org sameAs).
   */
  social: {
    instagram: '',
    facebook: '',
    tiktok: '',
  },
  /**
   * Calendly link embedded on /book: the whole scheduling page
   * ('https://calendly.com/<name>') or one event type
   * ('https://calendly.com/<name>/<event>'). Empty shows "booking opens soon".
   */
  calendlyUrl: '',
  nav: [
    { label: 'Home', to: '/' },
    { label: 'About', to: '/about' },
    { label: 'Book', to: '/book' },
    { label: 'Contact', to: '/contact' },
  ],
  legal: [
    { label: 'Privacy', to: '/privacy' },
    { label: 'Terms', to: '/terms' },
  ],
};

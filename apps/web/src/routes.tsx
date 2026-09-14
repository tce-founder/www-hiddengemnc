import type { ReactNode } from 'react';
import AboutPage from './pages/AboutPage';
import BookPage from './pages/BookPage';
import ContactPage from './pages/ContactPage';
import HomePage from './pages/HomePage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';

export interface SiteRoute {
  path: string;
  element: ReactNode;
  /** sitemap.xml entry. `false` leaves the page out (it is still prerendered). */
  sitemap?: { priority?: number } | false;
}

/**
 * Every page on the site. To add one:
 *   1. create it in src/pages/ (copy AboutPage.tsx as a starting point),
 *   2. add a line here.
 * That's all — the build prerenders it and adds it to sitemap.xml
 * automatically. Add it to `site.nav` in src/config/site.ts to show it in the
 * header.
 */
export const siteRoutes: SiteRoute[] = [
  { path: '/', element: <HomePage />, sitemap: { priority: 1 } },
  { path: '/about', element: <AboutPage />, sitemap: { priority: 0.8 } },
  { path: '/book', element: <BookPage />, sitemap: { priority: 0.9 } },
  { path: '/contact', element: <ContactPage />, sitemap: { priority: 0.8 } },
  { path: '/privacy', element: <PrivacyPage />, sitemap: { priority: 0.3 } },
  { path: '/terms', element: <TermsPage />, sitemap: { priority: 0.3 } },
];

import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { AppShell } from './App';
import { type HeadCollector, HeadCollectorContext } from './lib/head-context';
import type { HeadTag } from './lib/seo';
import { siteRoutes } from './routes';

/**
 * Build-time render entry, used by scripts/prerender.mjs (see that file for why).
 * Renders one URL and returns its body markup plus the head tags its <Seo>
 * registered.
 */
export function render(url: string): { html: string; head: HeadTag[] } {
  const head: HeadTag[] = [];
  const collector: HeadCollector = { add: (tags) => head.push(...tags) };

  const html = renderToString(
    <HeadCollectorContext value={collector}>
      <MemoryRouter initialEntries={[url]}>
        <AppShell />
      </MemoryRouter>
    </HeadCollectorContext>,
  );

  return { html, head };
}

/** The route table without the React elements — what the prerenderer needs. */
export const routes = siteRoutes.map(({ path, sitemap }) => ({ path, sitemap }));

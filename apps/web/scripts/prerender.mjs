/**
 * Prerender every route to static HTML, then write sitemap.xml and robots.txt.
 *
 * The site is a React SPA, so without this every URL would return the same
 * empty `<div id="root">` with the homepage's metadata. Anything that doesn't
 * run JavaScript — LinkedIn/Slack/iMessage link previews, many crawlers — would
 * see no content and the wrong title on every page.
 *
 * Runs after `vite build` (client) and `vite build --ssr` (entry-server.tsx):
 * renders each route from src/routes.tsx and writes real HTML — the page's own
 * head tags plus fully rendered body — to dist/<route>/index.html. The browser
 * still boots with createRoot, so React re-renders on load; the static HTML is
 * for crawlers and first paint.
 *
 * Any failure exits non-zero so a broken page fails the build rather than
 * shipping an empty shell.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(webRoot, 'dist');
const ssrEntry = path.join(webRoot, 'dist-ssr', 'entry-server.js');

const SITE_URL = (process.env.VITE_SITE_URL || 'https://hiddengemnc.com').replace(/\/+$/, '');
const SITE_ENV = process.env.VITE_SITE_ENV || 'local';
const ROOT_DIV = '<div id="root"></div>';

function fail(message) {
  console.error(`\n[prerender] ${message}\n`);
  process.exit(1);
}

if (!existsSync(ssrEntry)) fail(`SSR bundle missing at ${ssrEntry} — run the SSR build first.`);
if (!existsSync(path.join(distDir, 'index.html')))
  fail('dist/index.html missing — run vite build first.');

const { render, routes } = await import(pathToFileURL(ssrEntry).href);
if (!Array.isArray(routes) || routes.length === 0) fail('entry-server exported no routes');

const escapeAttr = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Serialise the tags <Seo> registered. `data-seo` lets the browser remove them on load. */
function headHtml(tags) {
  return tags
    .map((tag) => {
      if (tag.tag === 'title') return `<title data-seo>${escapeAttr(tag.text)}</title>`;
      const attrs = Object.entries(tag.attrs)
        .map(([key, value]) => ` ${key}="${escapeAttr(value)}"`)
        .join('');
      if (tag.tag === 'script') return `<script data-seo${attrs}>${tag.text}</script>`;
      return `<${tag.tag} data-seo${attrs} />`;
    })
    .join('\n    ');
}

/** Drop the fallback tags in index.html — each page supplies its own. */
function stripFallbackHead(html) {
  return html
    .replace(/[ \t]*<title data-seo>[\s\S]*?<\/title>\r?\n?/g, '')
    .replace(/[ \t]*<(meta|link) data-seo[^>]*>\r?\n?/g, '');
}

const template = stripFallbackHead(await readFile(path.join(distDir, 'index.html'), 'utf8'));
if (!template.includes('</head>')) fail('template has no </head>');
if (!template.includes(ROOT_DIV)) fail(`template no longer contains ${ROOT_DIV}`);

// Every public route, plus the not-found page CloudFront serves for unknown paths.
const pages = [...routes.map((route) => route.path), '/404'];

for (const route of pages) {
  let result;
  try {
    result = render(route);
  } catch (error) {
    fail(`render failed for ${route}:\n${error?.stack || error}`);
  }

  const { html, head } = result;
  if (!html?.trim()) fail(`${route} rendered no markup`);
  if (!head.some((tag) => tag.tag === 'title')) {
    fail(`${route} rendered no <title> — does the page render <Seo>?`);
  }

  const page = template
    .replace('</head>', `  ${headHtml(head)}\n  </head>`)
    .replace(ROOT_DIV, `<div id="root">${html}</div>`);

  const outPath =
    route === '/'
      ? path.join(distDir, 'index.html')
      : route === '/404'
        ? path.join(distDir, '404.html')
        : path.join(distDir, route, 'index.html');

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, page, 'utf8');
  console.log(`[prerender] ${route.padEnd(24)} -> ${path.relative(webRoot, outPath)}`);
}

// sitemap.xml — generated from the same route table, so it can't drift.
const urls = routes
  .filter((route) => route.sitemap !== false)
  .map((route) => {
    const priority = route.sitemap?.priority ?? 0.5;
    return `  <url><loc>${SITE_URL}${route.path === '/' ? '/' : route.path}</loc><priority>${priority.toFixed(1)}</priority></url>`;
  });
await writeFile(
  path.join(distDir, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
);

// robots.txt — only production is indexable.
await writeFile(
  path.join(distDir, 'robots.txt'),
  SITE_ENV === 'prod'
    ? `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n',
);

console.log(
  `\n[prerender] wrote ${pages.length} pages, sitemap.xml and robots.txt (env: ${SITE_ENV})`,
);

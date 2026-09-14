import { site } from '@/config/site';

export interface SeoProps {
  /** Page title. Rendered as "Title | Hidden Gem NC"; omit on the homepage. */
  title?: string;
  /** ~150 characters. Falls back to the site description. */
  description?: string;
  /** Route path, e.g. "/about". Becomes the canonical URL and og:url. */
  path?: string;
  /** Absolute URL of a 1200×630 social image. */
  image?: string;
  type?: 'website' | 'article';
  /** Keep this page out of search results (e.g. the 404 page). */
  noindex?: boolean;
  /** JSON-LD structured data. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export type HeadTag =
  | { tag: 'title'; text: string }
  | { tag: 'meta' | 'link'; attrs: Record<string, string> }
  | { tag: 'script'; attrs: Record<string, string>; text: string };

export function pageTitle(title?: string): string {
  return title ? `${title} | ${site.name}` : `${site.name} — ${site.tagline}`;
}

/** JSON for an inline <script>; `<` is escaped so the payload can't close the tag. */
export function jsonLdText(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** The head tags for a page, shared by the browser render and the prerenderer. */
export function buildHeadTags(props: SeoProps): HeadTag[] {
  const title = pageTitle(props.title);
  const description = props.description ?? site.description;
  const url = `${site.url}${props.path && props.path !== '/' ? props.path : '/'}`;
  const image = props.image ?? site.defaultOgImage;
  const noindex = props.noindex || !site.indexable;
  const jsonLd = props.jsonLd ? [props.jsonLd].flat() : [];

  const tags: HeadTag[] = [
    { tag: 'title', text: title },
    { tag: 'meta', attrs: { name: 'description', content: description } },
    { tag: 'link', attrs: { rel: 'canonical', href: url } },
    { tag: 'meta', attrs: { property: 'og:site_name', content: site.name } },
    { tag: 'meta', attrs: { property: 'og:title', content: title } },
    { tag: 'meta', attrs: { property: 'og:description', content: description } },
    { tag: 'meta', attrs: { property: 'og:type', content: props.type ?? 'website' } },
    { tag: 'meta', attrs: { property: 'og:url', content: url } },
    {
      tag: 'meta',
      attrs: { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' },
    },
    { tag: 'meta', attrs: { name: 'twitter:title', content: title } },
    { tag: 'meta', attrs: { name: 'twitter:description', content: description } },
  ];

  if (image) {
    tags.push(
      { tag: 'meta', attrs: { property: 'og:image', content: image } },
      { tag: 'meta', attrs: { name: 'twitter:image', content: image } },
    );
  }
  if (noindex) {
    tags.push({ tag: 'meta', attrs: { name: 'robots', content: 'noindex, nofollow' } });
  }
  for (const data of jsonLd) {
    tags.push({ tag: 'script', attrs: { type: 'application/ld+json' }, text: jsonLdText(data) });
  }

  return tags;
}

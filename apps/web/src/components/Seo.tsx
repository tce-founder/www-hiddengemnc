import { use } from 'react';
import { HeadCollectorContext } from '@/lib/head-context';
import { buildHeadTags, type HeadTag, type SeoProps } from '@/lib/seo';

/**
 * Per-page title, description, canonical URL, Open Graph/Twitter tags and
 * optional JSON-LD. Render exactly one on every page:
 *
 *   <Seo title="About" description="…" path="/about" />
 *
 * In the browser these are plain elements that React 19 hoists into <head>.
 * During the build, the prerenderer collects them instead and writes them into
 * each page's static HTML (scripts/prerender.mjs), so link previews and
 * crawlers see the right metadata without running JavaScript.
 */
export function Seo(props: SeoProps) {
  const collector = use(HeadCollectorContext);
  const tags = buildHeadTags(props);

  if (collector) {
    collector.add(tags);
    return null;
  }

  return <>{tags.map(renderTag)}</>;
}

function renderTag(tag: HeadTag, index: number) {
  switch (tag.tag) {
    case 'title':
      return <title key="title">{tag.text}</title>;
    case 'meta':
      return <meta key={index} {...tag.attrs} />;
    case 'link':
      return <link key={index} {...tag.attrs} />;
    case 'script':
      return <script key={index} {...tag.attrs} dangerouslySetInnerHTML={{ __html: tag.text }} />;
  }
}

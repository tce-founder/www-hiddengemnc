import { describe, expect, it } from 'vitest';
import { site } from '../config/site';
import { buildHeadTags, jsonLdText, pageTitle } from './seo';

describe('pageTitle', () => {
  it('suffixes page titles with the site name', () => {
    expect(pageTitle('About')).toBe('About | Hidden Gem NC');
  });
});

describe('buildHeadTags', () => {
  it('emits exactly one title and a canonical URL for the path', () => {
    const tags = buildHeadTags({ title: 'About', path: '/about' });
    expect(tags.filter((t) => t.tag === 'title')).toHaveLength(1);
    // The origin comes from VITE_SITE_URL, which differs per build.
    expect(tags).toContainEqual({
      tag: 'link',
      attrs: { rel: 'canonical', href: `${site.url}/about` },
    });
  });

  it.skipIf(site.indexable)('marks non-production builds noindex', () => {
    expect(buildHeadTags({})).toContainEqual({
      tag: 'meta',
      attrs: { name: 'robots', content: 'noindex, nofollow' },
    });
  });
});

describe('jsonLdText', () => {
  it('cannot break out of its script tag', () => {
    expect(jsonLdText({ name: '</script><script>alert(1)</script>' })).not.toContain('</script>');
  });
});

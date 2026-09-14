import { describe, expect, it } from 'vitest';
import { site } from '@/config/site';
import { socialProfiles } from './social';

describe('socialProfiles', () => {
  it('lists the networks that have a URL, in display order', () => {
    expect(
      socialProfiles({
        tiktok: 'https://www.tiktok.com/@hiddengemnc',
        facebook: '',
        instagram: ' https://www.instagram.com/hiddengemnc ',
      }),
    ).toEqual([
      { network: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/hiddengemnc' },
      { network: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/@hiddengemnc' },
    ]);
  });

  it("leaves out links that aren't https on the network's own site", () => {
    expect(
      socialProfiles({
        instagram: 'http://instagram.com/hiddengemnc',
        facebook: 'https://example.com/facebook.com/hiddengemnc',
        tiktok: 'not a url',
      }),
    ).toEqual([]);
    expect(socialProfiles({ instagram: 'https://www.instagram.com/' })).toEqual([]);
  });

  it('accepts every profile configured in site.ts', () => {
    const configured = Object.values(site.social)
      .map((url) => url.trim())
      .filter(Boolean);
    expect(socialProfiles(site.social).map((profile) => profile.url)).toEqual(configured);
  });
});

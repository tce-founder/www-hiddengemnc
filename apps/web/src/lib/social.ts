/** Social networks the site can link to, in display order. */
export const SOCIAL_NETWORKS = ['instagram', 'facebook', 'tiktok'] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export interface SocialProfile {
  network: SocialNetwork;
  label: string;
  url: string;
}

const NETWORKS: Record<SocialNetwork, { label: string; hosts: string[] }> = {
  instagram: { label: 'Instagram', hosts: ['instagram.com', 'www.instagram.com'] },
  facebook: { label: 'Facebook', hosts: ['facebook.com', 'www.facebook.com'] },
  tiktok: { label: 'TikTok', hosts: ['tiktok.com', 'www.tiktok.com'] },
};

/**
 * The profiles to show: each configured URL that is https on its network's own
 * site. Anything else is left out rather than linked.
 */
export function socialProfiles(urls: Partial<Record<SocialNetwork, string>>): SocialProfile[] {
  return SOCIAL_NETWORKS.flatMap((network) => {
    const url = urls[network]?.trim();
    if (!url || !isProfileUrl(url, NETWORKS[network].hosts)) return [];
    return [{ network, label: NETWORKS[network].label, url }];
  });
}

function isProfileUrl(url: string, hosts: string[]): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' && hosts.includes(parsed.hostname) && parsed.pathname.length > 1
    );
  } catch {
    return false;
  }
}

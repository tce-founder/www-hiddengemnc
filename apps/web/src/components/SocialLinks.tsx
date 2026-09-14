import type { ReactElement, SVGProps } from 'react';
import { site } from '@/config/site';
import { type SocialNetwork, socialProfiles } from '@/lib/social';
import { cn } from '@/lib/utils';

type IconProps = SVGProps<SVGSVGElement>;

// Outline marks drawn to match the other icons (Lucide no longer ships brand icons).
const outline = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function InstagramIcon(props: IconProps) {
  return (
    <svg {...outline} {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.5 6.5h.01" />
    </svg>
  );
}

function FacebookIcon(props: IconProps) {
  return (
    <svg {...outline} {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function TikTokIcon(props: IconProps) {
  return (
    <svg {...outline} {...props}>
      <path d="M15 3v12.5a3.5 3.5 0 1 1-3.5-3.5" />
      <path d="M15 3c.5 2.5 2.5 4.5 5 5" />
    </svg>
  );
}

const ICONS: Record<SocialNetwork, (props: IconProps) => ReactElement> = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  tiktok: TikTokIcon,
};

/** Icon links to the profiles in site.social; renders nothing until one is set. */
export function SocialLinks({ className }: { className?: string }) {
  const profiles = socialProfiles(site.social);
  if (profiles.length === 0) return null;

  return (
    <ul aria-label="Social media" className={cn('flex items-center gap-1', className)}>
      {profiles.map(({ network, label, url }) => {
        const Icon = ICONS[network];
        return (
          <li key={network}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${site.name} on ${label}`}
              className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Icon className="size-5" aria-hidden="true" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

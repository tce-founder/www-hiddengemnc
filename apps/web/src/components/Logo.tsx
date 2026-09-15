import { site } from '@/config/site';
import { cn } from '@/lib/utils';

/**
 * PLACEHOLDER wordmark. Replace the SVG with the real logo — either paste the
 * logo's SVG markup here, or put the file in src/assets and render
 * `<img src={logoUrl} alt="Hidden Gem NC" />`.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-display font-semibold', className)}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="size-7 shrink-0">
        <rect width="32" height="32" rx="8" className="fill-primary" />
        <path
          d="M10 7c0 6 12 12 12 18M22 7c0 6-12 12-12 18"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="stroke-accent"
        />
        <path
          d="M12 12h8M12 20h8"
          strokeWidth="2"
          strokeLinecap="round"
          className="stroke-primary-foreground/80"
        />
      </svg>
      <span>{site.name}</span>
    </span>
  );
}

import { Link } from 'react-router';
import { Logo } from '@/components/Logo';
import { SocialLinks } from '@/components/SocialLinks';
import { site } from '@/config/site';

export function SiteFooter() {
  return (
    <footer className="border-t bg-secondary/50">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm space-y-3">
          <Logo />
          <p className="text-sm text-muted-foreground">{site.tagline}</p>
          <SocialLinks className="-ml-2" />
        </div>

        <nav aria-label="Footer" className="flex gap-12 text-sm">
          <ul className="space-y-2">
            {site.nav.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="text-muted-foreground hover:text-foreground">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <ul className="space-y-2">
            {site.legal.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="text-muted-foreground hover:text-foreground">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-6 py-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {site.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

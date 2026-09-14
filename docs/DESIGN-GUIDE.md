# Design guide

For whoever is shaping the look and content of the site. Everything here lives
in `apps/web`. You don't need to touch the API or the infrastructure to
redesign the site.

## See your changes

**On your machine** (live reload as you save):

```bash
pnpm install     # first time only
pnpm dev         # open http://localhost:8080
```

**On the dev site:** merge a PR into `develop` and it deploys to
https://www.d.hiddengemnc.com in a few minutes (ask for the password).

## Where things are

| To change…                           | Edit                                                     |
| ------------------------------------ | -------------------------------------------------------- |
| Colours, radius, fonts               | `src/styles/globals.css` (the design tokens at the top)  |
| Site name, tagline, navigation links | `src/config/site.ts`                                     |
| Logo                                 | `src/components/Logo.tsx` and `public/favicon.svg`       |
| Header / footer                      | `src/components/layout/SiteHeader.tsx`, `SiteFooter.tsx` |
| A page's content                     | `src/pages/*.tsx`                                        |
| Buttons, inputs and other UI pieces  | `src/components/ui/*` (shadcn/ui)                        |
| Contact form fields and topics       | `src/pages/ContactPage.tsx`                              |

Everything currently on the pages is **placeholder copy** and a placeholder
navy/amber palette. It's there to show the structure, not as a design
direction.

## Colours and type

The tokens at the top of `src/styles/globals.css` drive every component:

```css
--primary: oklch(0.27 0.06 265); /* buttons, links, hero background */
--accent: oklch(0.8 0.16 75); /* highlights: eyebrows, icons */
--radius: 0.625rem; /* corner rounding everywhere */
```

- Any CSS colour format works (`#14213d`, `rgb()`, `hsl()`), so paste straight
  from Figma.
- Each `--x-foreground` is the text colour used on `--x`. Keep each pair at
  **4.5:1 contrast or better** (check at
  https://webaim.org/resources/contrastchecker/).
- In markup, tokens become Tailwind classes: `bg-primary`,
  `text-muted-foreground`, `border-border`, `rounded-lg`…

**Fonts:** add the font's `<link>` to `index.html` (Google Fonts / Adobe Fonts)
or put the files in `public/fonts`, then put the family first in `--font-sans`
(body) or `--font-display` (headings) in `globals.css`.

## Add a page

1. Copy `src/pages/AboutPage.tsx` to e.g. `src/pages/ServicesPage.tsx`, rename
   the function and change the `<Seo>` title, description and path.
2. Add one line to `src/routes.tsx`:
   ```tsx
   { path: '/services', element: <ServicesPage />, sitemap: { priority: 0.8 } },
   ```
3. To show it in the header, add it to `nav` in `src/config/site.ts`.

The build prerenders it and adds it to `sitemap.xml` automatically.

## Add a UI component

The UI kit is [shadcn/ui](https://ui.shadcn.com/docs/components): components
are copied into the repo, so you can restyle them freely. To add one:

```bash
cd apps/web
pnpm dlx shadcn@latest add card dialog accordion
```

They land in `src/components/ui/` and use the design tokens automatically.

## Images

- Images used by a component go in `src/assets/` and are imported:
  `import hero from '@/assets/hero.jpg'` then `<img src={hero} alt="…" />`.
  The build fingerprints and optimises them.
- Files that need a fixed URL (favicon, social card, downloads) go in `public/`.
- **Social card:** add a 1200×630 `public/og-image.png`, then set
  `defaultOgImage` in `src/config/site.ts` to
  `'https://hiddengemnc.com/og-image.png'`.
- Every meaningful image needs `alt` text; decorative ones get `alt=""`.

## Search and sharing

Every page renders one `<Seo>` with its title, a ~150-character description and
its path. That is what Google and link previews (LinkedIn, Slack, iMessage)
show. The dev site is automatically hidden from search engines; only production
is indexable.

## The contact form

Submissions are stored and emailed to the team (see `contactAdminEmails` in
`infra/cdk.json`). Change the **Topic** options in `TOPICS` in
`ContactPage.tsx`. The topic appears in the notification email's subject, so
inbox rules can sort by it. Adding a new field also needs a matching change in
`apps/api/src/contact/contact.dto.ts` (ask a developer); the API rejects
fields it doesn't know.

## Please leave alone

- `/api/...` URLs. CloudFront sends them to the API, so a page can't live there.
- `scripts/prerender.mjs`, `src/entry-server.tsx`, `vite.config.ts`: build
  plumbing.
- Anything outside `apps/web`.

## Before you open a PR

- The page looks right at phone width (~375px) and desktop.
- Headings go in order (one `h1` per page, then `h2`, `h3`).
- You can reach and see focus on everything with the Tab key.
- `pnpm lint` and `pnpm build` pass (CI runs these too).

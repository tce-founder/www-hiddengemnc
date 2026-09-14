# hiddengemnc.com

The public website for Hidden Gem NC: a prerendered React site, a small contact
API, online booking through Calendly, and the AWS infrastructure for them,
deployed by GitHub Actions.

| Environment | Branch    | URL                                                | AWS account                   |
| ----------- | --------- | -------------------------------------------------- | ----------------------------- |
| dev         | `develop` | https://www.d.hiddengemnc.com (password-protected) | 074127281063 (`ben-tce-root`) |
| prod        | `main`    | https://hiddengemnc.com (`www` redirects to it)    | 074127281063 (`ben-tce-root`) |

Both environments are in one AWS account, the organization's management
account. [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) covers what that means, the
pipeline, and first-time setup.

## What's here

```
apps/web/           Vite + React 19 + Tailwind v4 + shadcn/ui, prerendered to static HTML
apps/api/           NestJS 11 contact API, on Lambda behind CloudFront /api/*
libs/shared/        Types shared by web and api
infra/              CDK app (config: cdk.json → "hiddengem")
scripts/bootstrap/  One-time AWS and GitHub setup
docs/               DEPLOYMENT.md (pipeline and setup), DESIGN-GUIDE.md (for the designer)
```

## Getting started

Node (version in `.nvmrc`) and pnpm 10:

```bash
pnpm install
pnpm dev          # web on :8080, API on :3001
```

Before opening a PR: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`,
`pnpm test`, `pnpm build`, `pnpm synth`, `pnpm smoke:lambda`.

## Site settings

`apps/web/src/config/site.ts` holds the name, navigation and these:

- **`social`**: Instagram, Facebook and TikTok profile URLs. Each one that's
  set shows as an icon in the footer and is listed for search engines
  (schema.org `sameAs`).
- **`calendlyUrl`**: the Calendly scheduling link embedded on `/book`. Until
  it's set, `/book` says booking opens soon and points to the contact form.

Analytics is GA4, with one property per environment in the "Hidden Gem NC"
Google Analytics account. Its measurement IDs are the `GA_MEASUREMENT_ID`
variables on the GitHub Environments. The contact form sends `generate_lead`
and a Calendly booking sends `book_appointment`; mark them as key events in GA4
to count them as conversions.

## Branches

feature → PR into `develop` (deploys dev) → PR `develop` → `main` (deploys prod).

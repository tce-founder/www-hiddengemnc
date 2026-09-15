# CLAUDE.md

hiddengemnc.com: pnpm + Nx monorepo. `apps/web` (Vite, React 19,
Tailwind v4, shadcn/ui, prerendered), `apps/api` (NestJS 11 on Lambda),
`libs/shared` (types only), `infra` (AWS CDK). See README.md for the overview.

## Commands

Run before opening a PR, in this order: `pnpm format:check`, `pnpm lint`,
`pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm synth`, `pnpm smoke:lambda`.
Local dev: `pnpm dev` (web :8080, api :3001).

## Rules that matter

- **The Lambda is bundled from tsc output** (`apps/api/dist/lambda.js`), never
  from `src`. esbuild drops decorator metadata, which breaks Nest DI and makes
  ValidationPipe silently skip validation. `pnpm smoke:lambda` guards this.
- **The API is same-origin only**: CloudFront `/api/*` in AWS, the Vite proxy
  locally. No CORS. Every route requires the `x-origin-verify` header (global
  guard). Don't add CORS or exempt routes.
- **Fail closed:** reCAPTCHA rejects when unconfigured (except with
  `ALLOW_UNVERIFIED_SUBMISSIONS=true`, local only). Don't add fallbacks that
  accept unverified input in deployed environments.
- **Email:** untrusted values are escaped at render time (`escapeHtml`). The
  submitter's acknowledgement contains nothing they typed (anti-relay). Never
  log submission contents.
- **Only `VITE_*` variables reach the browser, and they're public.** No secrets there.
- **Infra config lives in `infra/cdk.json` → `hiddengem`.** Don't hardcode
  accounts or domains in stacks.
- **Dev and prod share one AWS account** (074127281063, the organization's
  management account, which other projects use too). Prefix every resource
  name with `hiddengem` and include the environment. Never change the
  account's CDKToolkit stack or anything belonging to other projects.
- **The hiddengemnc.com hosted zone already exists** (`Z0817356V8RW3DE0JHLW`).
  CDK imports it by id and writes only its own record names: the `d.` and
  `mail.` delegations and prod's site records. Never create or replace the
  zone, and never touch records CDK didn't create.
- **SES has production access for the whole account**, so dev must never email
  submitters (`sendConfirmationEmail: false` in cdk.json).
- **Third-party scripts:** gtag.js (GA4, dev and prod builds only), reCAPTCHA
  (contact page) and Calendly (`/book` only). Load anything new only on the
  page that needs it, and add it to the privacy page.
- **Versions:** TypeScript is pinned to 5.9 (pnpm catalog). Nest stays on 11
  (12 is ESM-only). Use `catalog:` for shared tool versions.

## Web conventions

- Pages go in `src/pages`, registered in `src/routes.tsx`, which drives the
  router, the prerender and sitemap.xml. Every page renders one `<Seo>`.
- Name, navigation, social links and the Calendly link are in
  `src/config/site.ts`.
- Design tokens live in `src/styles/globals.css`. Use token classes
  (`bg-primary`), not raw colours.
- Add UI components with `pnpm dlx shadcn@latest add <name>` from `apps/web`.

## Branches

feature → PR into `develop` (deploys dev) → PR `develop` → `main` (deploys prod).

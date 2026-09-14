# Deployment

GitHub Actions deploys `develop` to dev and `main` to prod
(`.github/workflows/deploy.yml`). CI (`ci.yml`) checks every pull request.
AWS access is GitHub OIDC only; there are no stored AWS keys.

## The AWS account

Dev and prod share one account: **074127281063** (AWS CLI profile
`ben-tce-root`), which is the organization's management account and also runs
other projects. That shapes the setup:

- **One GitHub OIDC provider** for the account, with a deploy role per
  environment (`hiddengem-dev-github-deploy`, `hiddengem-prod-github-deploy`).
  Each role trusts only this repository running in the GitHub Environment of
  the same name.
- **GitHub keeps dev and prod apart, not IAM.** The `prod` Environment accepts
  deployments from `main` only. Both roles deploy through the account's shared
  CDK bootstrap roles, whose CloudFormation execution role is an
  administrator, so either can change anything in the account. Organization
  policies (SCPs) don't apply to a management account either. Separate
  accounts are the fix if that ever matters.
- **Everything is prefixed `hiddengem`** and includes the environment, so
  nothing collides with the other projects.
- The account's existing CDK bootstrap (`CDKToolkit`) is used as it is; the
  scripts never change it.

| Stack                         | What it holds                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `HiddenGem-Shared-GithubOidc` | GitHub OIDC provider and both deploy roles. Deployed by the prod pipeline only.          |
| `HiddenGem-<Env>-Dns`         | The environment's zone (`d.hiddengemnc.com` / `mail.hiddengemnc.com`) and its delegation |
| `HiddenGem-<Env>-Email`       | SES sending identity with DKIM, SPF (MAIL FROM) and DMARC records                        |
| `HiddenGem-<Env>-Backend`     | Contact API: Lambda, API Gateway, DynamoDB, origin secret                                |
| `HiddenGem-<Env>-Frontend`    | S3, CloudFront, certificate, DNS aliases, and WAF when switched on                       |

All accounts, domains and switches are in the `hiddengem` block of
`infra/cdk.json`; `infra/lib/config.ts` checks them on every synth.

## DNS

`hiddengemnc.com` is registered in Route 53 in the same account, and its hosted
zone (`Z0817356V8RW3DE0JHLW`) already exists. CDK imports the zone and adds
only these records to it:

- NS records delegating `d.hiddengemnc.com` (dev) and `mail.hiddengemnc.com`
  (prod) to zones CDK creates for each environment
- prod only: A and AAAA aliases for `hiddengemnc.com` and `www.hiddengemnc.com`,
  and the certificate's validation records

Dev's certificate, validation and alias records live in `d.hiddengemnc.com`.
Nothing else in the apex zone is touched, so mail or verification records
added there later are safe.

## Email

The contact API sends from `noreply@d.hiddengemnc.com` (dev) and
`noreply@mail.hiddengemnc.com` (prod). The Email stack verifies each domain
with Easy DKIM and writes its records, so there's nothing to do by hand.

The account has SES **production access**, so mail reaches any address and the
recipients in `contactAdminEmails` need no verification. That's also why dev
has `sendConfirmationEmail: false`: otherwise anyone testing the dev form with
a real address would get an email.

## WAF

WAF is off for both environments (`waf: false`). A static site behind CloudFront
has no server code for WAF's rules to protect, and the contact API already
rejects anything without a valid reCAPTCHA token or CloudFront's secret
header, with API Gateway capped at 5 requests a second. The worst case without
WAF is spam, not a breach.

If spam or scraping becomes a problem, set `waf: true` for the environment and
deploy. That adds AWS managed rules and per-IP rate limits (30 API requests per
5 minutes) for about $10 a month per environment.

## GitHub Environment settings

| Name                   | Kind     | dev | prod | Notes                                                |
| ---------------------- | -------- | :-: | :--: | ---------------------------------------------------- |
| `AWS_DEPLOY_ROLE_ARN`  | variable |  ●  |  ●   | Set by `configure-github.sh`                         |
| `RECAPTCHA_SITE_KEY`   | variable |  ●  |  ●   | Public. One reCAPTCHA v3 key per environment         |
| `RECAPTCHA_SECRET_KEY` | secret   |  ●  |  ●   | Without it the contact form rejects every submission |
| `GA_MEASUREMENT_ID`    | variable |  ●  |  ●   | Public. Unset means no analytics                     |
| `BASIC_AUTH_PASSWORD`  | secret   |  ●  |      | Dev preview password                                 |
| `BASIC_AUTH_USERNAME`  | variable |  ○  |      | Defaults to `hiddengem`                              |

The reCAPTCHA keys are in the "Hidden Gem NC" Google Cloud project, owned by
benelliott@thecoraledge.com: prod allows `hiddengemnc.com` and
`www.hiddengemnc.com`; dev allows `www.d.hiddengemnc.com` and `localhost`. The
GA4 properties are in the "Hidden Gem NC" Analytics account: prod
`G-VBBJ3T7FDM`, dev `G-59J6FFJ5TR`.

## First-time setup

1. **Sign in:** `aws sso login --profile ben-tce-root`
2. **Deploy roles:** `scripts/bootstrap/bootstrap-account.sh` checks the
   account's CDK bootstrap, then deploys `HiddenGem-Shared-GithubOidc`. CDK
   shows the IAM changes and asks before applying them.
3. **GitHub:** `scripts/bootstrap/configure-github.sh` previews, then
   `scripts/bootstrap/configure-github.sh --apply` creates `develop`, the `dev`
   and `prod` Environments with their branch rules, the role variables and
   branch protection. `--main-approvals=0` suits a single maintainer, who
   otherwise has to admin-merge their own release PRs. On a personal account,
   branch rules and protection need the repo to be public or GitHub Pro.
4. **Secrets and variables:** the script prints the `gh secret set` and
   `gh variable set` commands for the table above.
5. **Dev:** merge a PR into `develop`. The first deploy creates the zones and
   certificate, which takes 10 to 20 minutes. Check that
   https://www.d.hiddengemnc.com asks for the password and that
   `/api/health` returns 200.
6. **Prod:** open a PR from `develop` to `main` and merge it. Check that
   https://hiddengemnc.com loads, `www` redirects to it, and the contact form
   delivers.

## Operations

- **Logs:** CloudWatch `/aws/lambda/hiddengem-api-<env>`, kept for a month.
- **Submissions:** DynamoDB `hiddengem-contact-submissions-<env>`, kept for 90
  days, so an enquiry whose email was lost can be recovered.
- **Preview changes:** after `pnpm build`, run
  `pnpm exec cdk diff --all -c env=dev --profile ben-tce-root` in `infra`.

| Symptom                                                   | Fix                                                                                                      |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Preflight: set `AWS_DEPLOY_ROLE_ARN`                      | Run `configure-github.sh --apply` after `bootstrap-account.sh`.                                          |
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` | The job isn't in the matching Environment, or the repo was renamed or moved; check the `sub` in the log. |
| Certificate stuck in "Pending validation"                 | Check `dig +short NS d.hiddengemnc.com` lists awsdns servers (the delegation record).                    |
| Contact form: "Verification failed"                       | The reCAPTCHA key doesn't list the domain, or the secret belongs to the other key.                       |
| Form accepted but no email                                | Search the logs for `ADMIN_NOTIFICATION_FAILED`; check the SES suppression list.                         |
| `/book` says booking opens soon                           | Set `calendlyUrl` in `apps/web/src/config/site.ts` to a `https://calendly.com/...` link.                 |

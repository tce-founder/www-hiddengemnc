# API

NestJS 11 API behind CloudFront `/api/*`, running on AWS Lambda
(`src/lambda.ts`). Locally, `src/main.ts` serves it on http://localhost:3001.

| Route               | Purpose                                                           |
| ------------------- | ----------------------------------------------------------------- |
| `GET /api/health`   | Liveness check (used by the deploy smoke test)                    |
| `POST /api/contact` | Contact form: validate → reCAPTCHA → DynamoDB → SES notifications |

Every route requires the `x-origin-verify` header that CloudFront injects (the
Vite dev proxy adds it locally), so the API can't be called directly.

## Configuration

Set on the Lambda by `infra/lib/backend-stack.ts`. Locally, `src/main.ts` sets
safe defaults, and you can override them in `.env` (see `.env.example`).

| Variable                       | Meaning                                                                |
| ------------------------------ | ---------------------------------------------------------------------- |
| `API_ORIGIN_SECRET`            | Expected `x-origin-verify` value. Unset means every request is refused |
| `SUBMISSIONS_TABLE`            | DynamoDB table                                                         |
| `SES_FROM_ADDRESS`             | Verified SES sender                                                    |
| `CONTACT_ADMIN_EMAILS`         | Comma-separated recipients of new-enquiry notifications                |
| `RECAPTCHA_SECRET_KEY`         | reCAPTCHA v3 secret. Unset means every submission is rejected          |
| `RECAPTCHA_MIN_SCORE`          | Default `0.5`                                                          |
| `SEND_CONFIRMATION_EMAIL`      | `false` disables the acknowledgement to the submitter                  |
| `SUBMISSION_RETENTION_DAYS`    | DynamoDB TTL, default `90`                                             |
| `CONTACT_DRY_RUN`              | `true` logs instead of storing and emailing (local default)            |
| `ALLOW_UNVERIFIED_SUBMISSIONS` | `true` skips reCAPTCHA when no secret is set. **Local only**           |

## Tests

`pnpm test` (Jest). `src/lambda.spec.ts` drives the real Lambda handler with
API Gateway events. `pnpm smoke:lambda` (repo root, after `pnpm synth`) does
the same against the bundle CDK deploys.

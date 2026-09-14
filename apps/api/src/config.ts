import { Global, Module } from '@nestjs/common';

/**
 * Runtime configuration, read from the environment once at startup.
 *
 * Everything brand- or environment-specific comes from here so the same bundle
 * runs locally, in dev and in prod. The Lambda's environment is set in
 * infra/lib/backend-stack.ts; local defaults are applied in src/main.ts.
 */
export interface AppConfig {
  siteName: string;
  publicSiteUrl: string;
  /** DynamoDB table for contact submissions. */
  submissionsTable: string;
  /** How long a stored submission is kept before DynamoDB's TTL removes it. */
  submissionRetentionDays: number;
  /** Verified SES identity address mail is sent from. */
  sesFromAddress: string;
  /** Where new-submission notifications go: one message, every address in To. */
  contactAdminEmails: string[];
  /** Send the submitter an acknowledgement email. */
  sendConfirmationEmail: boolean;
  recaptchaSecretKey: string;
  recaptchaMinScore: number;
  /**
   * Accept submissions when no reCAPTCHA secret is configured. Local
   * development only — deployed environments never set it, so a missing secret
   * there rejects submissions instead of silently letting them through.
   */
  allowUnverifiedSubmissions: boolean;
  /** Shared secret CloudFront injects on every API request. */
  originSecret: string;
  /** Log submissions instead of storing them and sending email. */
  dryRun: boolean;
}

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    siteName: env.SITE_NAME || 'Hidden Gem NC',
    publicSiteUrl: env.PUBLIC_SITE_URL || 'https://hiddengemnc.com',
    submissionsTable: env.SUBMISSIONS_TABLE || '',
    submissionRetentionDays: toNumber(env.SUBMISSION_RETENTION_DAYS, 90),
    sesFromAddress: env.SES_FROM_ADDRESS || '',
    contactAdminEmails: toList(env.CONTACT_ADMIN_EMAILS),
    sendConfirmationEmail: env.SEND_CONFIRMATION_EMAIL !== 'false',
    recaptchaSecretKey: env.RECAPTCHA_SECRET_KEY || '',
    recaptchaMinScore: toNumber(env.RECAPTCHA_MIN_SCORE, 0.5),
    allowUnverifiedSubmissions: env.ALLOW_UNVERIFIED_SUBMISSIONS === 'true',
    originSecret: env.API_ORIGIN_SECRET || '',
    dryRun: env.CONTACT_DRY_RUN === 'true',
  };
}

function toNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(parsed) ? parsed : fallback;
}

/** Comma-separated list, e.g. `a@example.com, b@example.com`. */
function toList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig() }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}

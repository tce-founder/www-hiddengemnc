import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config';

interface SiteverifyResponse {
  success?: boolean;
  score?: number;
  action?: string;
  'error-codes'?: string[];
}

/**
 * reCAPTCHA v3 verification via Google's `siteverify`. Fails CLOSED: a
 * submission is accepted only when Google confirms the token, the action
 * matches and the score meets the threshold. Every other outcome — no token,
 * network error, low score, wrong action — rejects.
 *
 * Configuration (per environment):
 *   API: RECAPTCHA_SECRET_KEY        — the v3 secret key
 *   Web: VITE_RECAPTCHA_SITE_KEY     — the matching v3 site key
 */
@Injectable()
export class RecaptchaService {
  static readonly VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

  private readonly logger = new Logger(RecaptchaService.name);

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /** Throws unless the token proves a human submitted the form. */
  async assertHuman(token: string | undefined, expectedAction: string): Promise<void> {
    if (!this.config.recaptchaSecretKey) {
      if (this.config.allowUnverifiedSubmissions) {
        return; // Local development only (see AppConfig.allowUnverifiedSubmissions).
      }
      this.logger.error('RECAPTCHA_SECRET_KEY is not set — rejecting submission (fail closed)');
      throw new ServiceUnavailableException('Form verification is not configured');
    }

    if (!(await this.verify(token, expectedAction))) {
      throw new BadRequestException('Verification failed. Please try again.');
    }
  }

  async verify(token: string | undefined, expectedAction: string): Promise<boolean> {
    if (!token) {
      this.logger.warn('No reCAPTCHA token provided');
      return false;
    }

    let result: SiteverifyResponse;
    try {
      // Sent as a form body, never a query string: a URL carrying the secret
      // would be echoed into error objects and from there into CloudWatch.
      const response = await fetch(RecaptchaService.VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: this.config.recaptchaSecretKey, response: token }),
        signal: AbortSignal.timeout(5000),
      });
      result = (await response.json()) as SiteverifyResponse;
    } catch (error) {
      // Log the message only — never the request, which contains the secret.
      this.logger.error(
        `siteverify request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }

    if (!result.success) {
      this.logger.warn(`siteverify rejected token: ${(result['error-codes'] ?? []).join(',')}`);
      return false;
    }
    if (result.action !== expectedAction) {
      this.logger.warn(`Action mismatch: expected=${expectedAction} got=${result.action}`);
      return false;
    }
    if (typeof result.score !== 'number' || result.score < this.config.recaptchaMinScore) {
      this.logger.warn(`Score ${result.score} below threshold ${this.config.recaptchaMinScore}`);
      return false;
    }
    return true;
  }
}

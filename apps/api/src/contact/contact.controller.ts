import { Body, Controller, Post, Req } from '@nestjs/common';
import type { ContactResponse } from '@hiddengem/shared';
import type { Request } from 'express';
import { ContactRequestDto } from './contact.dto';
import { ContactService } from './contact.service';
import { RecaptchaService } from './recaptcha.service';

@Controller('contact')
export class ContactController {
  constructor(
    private readonly contact: ContactService,
    private readonly recaptcha: RecaptchaService,
  ) {}

  /**
   * Rate limiting is enforced before a request gets here — by the CloudFront
   * WAF rule on `/api/*` and API Gateway stage throttling (infra). An
   * in-process limiter would be per-Lambda-container and effectively useless.
   */
  @Post()
  async submit(@Body() dto: ContactRequestDto, @Req() request: Request): Promise<ContactResponse> {
    await this.recaptcha.assertHuman(dto.recaptchaToken, 'contact');

    const submissionId = await this.contact.submit(dto, {
      ipAddress: clientIp(request),
      userAgent: request.headers['user-agent'],
    });

    return {
      success: true,
      message: 'Thank you for getting in touch. We will reply shortly.',
      submissionId,
    };
  }
}

/** The first X-Forwarded-For entry is the viewer; later entries are CloudFront and API Gateway. */
function clientIp(request: Request): string | undefined {
  const forwarded = request.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || request.ip;
}

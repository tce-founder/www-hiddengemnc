import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ContactSubmission } from '@hiddengem/shared';
import { randomUUID } from 'node:crypto';
import { APP_CONFIG, type AppConfig } from '../config';
import type { ContactRequestDto } from './contact.dto';
import { adminNotificationEmail, confirmationEmail } from './email-templates';
import { MailerService } from './mailer.service';
import { SubmissionsRepository } from './submissions.repository';

/** Searchable marker for a CloudWatch metric filter / alarm on lost notifications. */
export const ADMIN_NOTIFICATION_FAILED = 'CONTACT_ADMIN_NOTIFICATION_FAILED';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly submissions: SubmissionsRepository,
    private readonly mailer: MailerService,
  ) {}

  /**
   * Stores the submission, then notifies. The DynamoDB write is the source of
   * truth: if it fails the request fails; if an email fails the enquiry is
   * still on record, so the submitter gets a success and the failure is logged
   * at error level.
   *
   * The submission itself is deliberately never logged — it is personal data,
   * and CloudWatch is more widely readable than the encrypted table.
   */
  async submit(
    dto: ContactRequestDto,
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<string> {
    const submission: ContactSubmission = {
      submissionId: randomUUID(),
      createdAt: new Date().toISOString(),
      name: dto.name,
      email: dto.email,
      organization: dto.organization || undefined,
      topic: dto.topic || undefined,
      message: dto.message,
      source: dto.source || undefined,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    };

    if (this.config.dryRun) {
      this.logger.log(
        `[dry run] accepted submission ${submission.submissionId} — not stored, no email sent`,
      );
      return submission.submissionId;
    }

    await this.submissions.save(submission);
    await this.notify(submission);
    return submission.submissionId;
  }

  private async notify(submission: ContactSubmission): Promise<void> {
    const [admin, confirmation] = await Promise.allSettled([
      this.mailer.send({
        to: this.config.contactAdminEmails,
        // Reply-To the submitter, so answering the notification reaches them.
        replyTo: submission.email,
        ...adminNotificationEmail(this.config, submission),
      }),
      this.config.sendConfirmationEmail
        ? this.mailer.send({
            to: [submission.email],
            ...confirmationEmail(this.config, submission),
          })
        : Promise.resolve(),
    ]);

    if (admin.status === 'rejected') {
      this.logger.error(
        `${ADMIN_NOTIFICATION_FAILED} submission=${submission.submissionId}`,
        describe(admin.reason),
      );
    }
    if (confirmation.status === 'rejected') {
      // Expected while SES is in sandbox: only verified recipients receive mail.
      this.logger.warn(
        `Confirmation email failed for submission ${submission.submissionId}: ${describe(confirmation.reason)}`,
      );
    }
  }
}

function describe(reason: unknown): string {
  return reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason);
}

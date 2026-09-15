import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { Inject, Injectable } from '@nestjs/common';
import { singleLine } from '../common/escape-html';
import { APP_CONFIG, type AppConfig } from '../config';

export interface OutboundEmail {
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

@Injectable()
export class MailerService {
  private readonly ses = new SESv2Client({});

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async send(email: OutboundEmail): Promise<void> {
    if (!this.config.sesFromAddress || email.to.length === 0) {
      throw new Error('Email is not configured (SES_FROM_ADDRESS / recipient missing)');
    }

    await this.ses.send(
      new SendEmailCommand({
        FromEmailAddress: `"${this.config.siteName.replace(/"/g, '')}" <${this.config.sesFromAddress}>`,
        Destination: { ToAddresses: email.to },
        ReplyToAddresses: email.replyTo ? [email.replyTo] : undefined,
        Content: {
          Simple: {
            Subject: { Data: singleLine(email.subject), Charset: 'UTF-8' },
            Body: {
              Html: { Data: email.html, Charset: 'UTF-8' },
              Text: { Data: email.text, Charset: 'UTF-8' },
            },
          },
        },
      }),
    );
  }
}

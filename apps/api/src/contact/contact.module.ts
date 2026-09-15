import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { MailerService } from './mailer.service';
import { RecaptchaService } from './recaptcha.service';
import { SubmissionsRepository } from './submissions.repository';

@Module({
  controllers: [ContactController],
  providers: [ContactService, MailerService, RecaptchaService, SubmissionsRepository],
})
export class ContactModule {}

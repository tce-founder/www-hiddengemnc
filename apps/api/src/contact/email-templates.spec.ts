import type { ContactSubmission } from '@hiddengem/shared';
import { adminNotificationEmail, confirmationEmail } from './email-templates';

const brand = { siteName: 'Hidden Gem NC', publicSiteUrl: 'https://hiddengemnc.com' };

const submission: ContactSubmission = {
  submissionId: '00000000-0000-4000-8000-000000000000',
  createdAt: '2026-09-10T12:00:00.000Z',
  name: 'Mallory <a href="https://evil.example">click</a>',
  email: 'victim@example.com',
  topic: 'Partnership\r\nBcc: everyone@example.com',
  message: 'Buy now at https://spam.example <script>alert(1)</script>',
};

describe('confirmationEmail', () => {
  it('contains nothing the submitter typed, so the form cannot relay content', () => {
    const { subject, html, text } = confirmationEmail(brand, submission);
    for (const part of [subject, html, text]) {
      expect(part).not.toContain('Mallory');
      expect(part).not.toContain('spam.example');
    }
    expect(text).toContain(submission.submissionId);
  });
});

describe('adminNotificationEmail', () => {
  it('escapes every submitted value in the HTML body', () => {
    const { html } = adminNotificationEmail(brand, submission);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<a href="https://evil.example">');
    expect(html).toContain('&lt;script&gt;');
  });

  it('keeps the subject on a single line', () => {
    const { subject } = adminNotificationEmail(brand, submission);
    expect(subject).not.toMatch(/[\r\n]/);
  });
});

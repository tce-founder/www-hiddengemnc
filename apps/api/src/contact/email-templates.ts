import type { ContactSubmission } from '@hiddengem/shared';
import { escapeHtml, singleLine } from '../common/escape-html';
import type { AppConfig } from '../config';

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

type Brand = Pick<AppConfig, 'siteName' | 'publicSiteUrl'>;

/**
 * Acknowledgement sent to the submitter.
 *
 * It intentionally contains nothing the submitter typed — no name, no message.
 * Anyone can enter someone else's address in a public form; if the reply
 * echoed their text, the form would become a relay for sending arbitrary
 * content from our domain.
 */
export function confirmationEmail(brand: Brand, submission: ContactSubmission): RenderedEmail {
  const site = escapeHtml(brand.siteName);
  const subject = `Thanks for contacting ${brand.siteName}`;

  const html = layout(
    subject,
    `
      <h1 style="font-size:20px;margin:0 0 16px;">Thanks for getting in touch</h1>
      <p>We've received your message and a member of the ${site} team will reply soon.</p>
      <p style="color:#6b7280;font-size:12px;margin-top:24px;">Reference: ${escapeHtml(submission.submissionId)}</p>
      <p style="color:#6b7280;font-size:12px;">If you didn't contact us, you can ignore this email.</p>
    `,
    brand,
  );

  const text = [
    'Thanks for getting in touch',
    '',
    `We've received your message and a member of the ${brand.siteName} team will reply soon.`,
    '',
    `Reference: ${submission.submissionId}`,
    "If you didn't contact us, you can ignore this email.",
    '',
    brand.publicSiteUrl,
  ].join('\n');

  return { subject, html, text };
}

/** Notification to the site team. Every submitted value is escaped. */
export function adminNotificationEmail(brand: Brand, submission: ContactSubmission): RenderedEmail {
  const who = singleLine(submission.name).slice(0, 80);
  const subject = submission.topic
    ? `[${singleLine(submission.topic).slice(0, 60)}] New enquiry from ${who}`
    : `New website enquiry from ${who}`;

  const row = (label: string, value?: string) =>
    value
      ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;vertical-align:top;">${label}</td><td style="padding:4px 0;">${escapeHtml(value)}</td></tr>`
      : '';

  const html = layout(
    subject,
    `
      <h1 style="font-size:20px;margin:0 0 16px;">New website enquiry</h1>
      <table style="border-collapse:collapse;font-size:14px;">
        ${row('Name', submission.name)}
        ${row('Email', submission.email)}
        ${row('Organization', submission.organization)}
        ${row('Topic', submission.topic)}
        ${row('Source', submission.source)}
        ${row('Received', submission.createdAt)}
      </table>
      <h2 style="font-size:16px;margin:24px 0 8px;">Message</h2>
      <p style="white-space:pre-wrap;margin:0;">${escapeHtml(submission.message)}</p>
      <p style="color:#6b7280;font-size:12px;margin-top:24px;">
        Submission ${escapeHtml(submission.submissionId)}
        ${submission.ipAddress ? ` · IP ${escapeHtml(submission.ipAddress)}` : ''}<br />
        Reply to this email to answer the sender directly.
      </p>
    `,
    brand,
  );

  const text = [
    'New website enquiry',
    '',
    `Name: ${submission.name}`,
    `Email: ${submission.email}`,
    submission.organization ? `Organization: ${submission.organization}` : '',
    submission.topic ? `Topic: ${submission.topic}` : '',
    submission.source ? `Source: ${submission.source}` : '',
    `Received: ${submission.createdAt}`,
    '',
    'Message:',
    submission.message,
    '',
    `Submission ${submission.submissionId}${submission.ipAddress ? ` · IP ${submission.ipAddress}` : ''}`,
  ]
    .filter((line, i, all) => line !== '' || all[i - 1] !== '')
    .join('\n');

  return { subject, html, text };
}

function layout(title: string, body: string, brand: Brand): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:24px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;line-height:1.6;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:32px;">
      ${body}
    </div>
    <p style="max-width:600px;margin:16px auto 0;color:#9ca3af;font-size:12px;text-align:center;">
      ${escapeHtml(brand.siteName)} · <a href="${escapeHtml(brand.publicSiteUrl)}" style="color:#9ca3af;">${escapeHtml(brand.publicSiteUrl.replace(/^https?:\/\//, ''))}</a>
    </p>
  </body>
</html>`;
}

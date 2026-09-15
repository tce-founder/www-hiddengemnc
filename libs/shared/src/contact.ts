/**
 * The contact form contract between apps/web and apps/api.
 *
 * Both sides import these with `import type`, so the shape is checked at
 * compile time in each app and nothing from this package ends up in either
 * runtime bundle. The API's validation rules (lengths, formats) live on its DTO
 * in apps/api/src/contact/contact.dto.ts.
 */

/** What the browser POSTs to `/api/contact`. */
export interface ContactRequest {
  name: string;
  email: string;
  organization?: string;
  /** What the enquiry is about; rendered into the admin email subject. */
  topic?: string;
  message: string;
  /** reCAPTCHA v3 token for the `contact` action. Required in deployed environments. */
  recaptchaToken?: string;
  /** Which page produced the enquiry, e.g. "contact-page". */
  source?: string;
}

/** What `/api/contact` returns on success. Errors use the API's standard error body. */
export interface ContactResponse {
  success: boolean;
  message: string;
  submissionId?: string;
}

/** A stored submission (DynamoDB item, minus the TTL attribute). */
export interface ContactSubmission {
  submissionId: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
  name: string;
  email: string;
  organization?: string;
  topic?: string;
  message: string;
  source?: string;
  ipAddress?: string;
  userAgent?: string;
}

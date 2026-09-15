import type { ContactRequest, ContactResponse } from '@hiddengem/shared';

/** Same-origin by default: CloudFront routes /api/* to the API (the Vite proxy does locally). */
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Field-level messages from the API's validation, when present. */
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function submitContact(
  payload: ContactRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<ContactResponse> {
  const response = await fetchImpl(`${API_BASE}/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  // Error pages from CloudFront/WAF are HTML, not JSON — tolerate both.
  const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };

  if (!response.ok) {
    const details = Array.isArray(body.message) ? body.message : [];
    const message =
      response.status === 429
        ? 'Too many requests. Please wait a minute and try again.'
        : response.status === 400 && details.length
          ? 'Please check the highlighted fields.'
          : 'Something went wrong sending your message. Please try again.';
    throw new ApiError(message, response.status, details);
  }

  return body as ContactResponse;
}

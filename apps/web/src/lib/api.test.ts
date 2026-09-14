import { describe, expect, it, vi } from 'vitest';
import { ApiError, submitContact } from './api';

const payload = { name: 'Ada', email: 'ada@example.com', message: 'Hello there, world.' };

function respond(status: number, body: unknown) {
  return vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
    );
}

describe('submitContact', () => {
  it('POSTs JSON to the same-origin API', async () => {
    const fetchImpl = respond(201, { success: true, message: 'ok', submissionId: 'abc' });
    await expect(submitContact(payload, fetchImpl)).resolves.toMatchObject({ success: true });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/contact');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual(payload);
  });

  it('surfaces validation messages', async () => {
    const fetchImpl = respond(400, { message: ['email must be an email'] });
    const error = await submitContact(payload, fetchImpl).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).details).toEqual(['email must be an email']);
  });

  it('copes with an HTML error page', async () => {
    const fetchImpl = respond(403, '<html>Forbidden</html>');
    await expect(submitContact(payload, fetchImpl)).rejects.toMatchObject({ status: 403 });
  });
});

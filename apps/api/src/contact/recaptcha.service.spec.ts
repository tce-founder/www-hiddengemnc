import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { type AppConfig, loadConfig } from '../config';
import { RecaptchaService } from './recaptcha.service';

function service(overrides: Partial<AppConfig> = {}): RecaptchaService {
  return new RecaptchaService({ ...loadConfig({}), recaptchaSecretKey: 'secret', ...overrides });
}

function googleSays(body: Record<string, unknown>) {
  return jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify(body)));
}

describe('RecaptchaService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('fails closed when no secret is configured', async () => {
    await expect(
      service({ recaptchaSecretKey: '' }).assertHuman('token', 'contact'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('allows unverified submissions only when explicitly enabled (local dev)', async () => {
    await expect(
      service({ recaptchaSecretKey: '', allowUnverifiedSubmissions: true }).assertHuman(
        undefined,
        'contact',
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects a missing token', async () => {
    const fetchSpy = googleSays({ success: true, action: 'contact', score: 0.9 });
    await expect(service().assertHuman(undefined, 'contact')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('accepts a verified token and keeps the secret out of the URL', async () => {
    const fetchSpy = googleSays({ success: true, action: 'contact', score: 0.9 });
    await expect(service().assertHuman('token', 'contact')).resolves.toBeUndefined();

    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(RecaptchaService.VERIFY_URL);
    expect(String(init?.body)).toContain('secret=secret');
  });

  it.each([
    ['Google rejects the token', { success: false, 'error-codes': ['invalid-input-response'] }],
    ['the action does not match', { success: true, action: 'login', score: 0.9 }],
    ['the score is too low', { success: true, action: 'contact', score: 0.1 }],
    ['the score is missing', { success: true, action: 'contact' }],
  ])('rejects when %s', async (_case, body) => {
    googleSays(body);
    await expect(service().assertHuman('token', 'contact')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('fails closed when Google cannot be reached', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    await expect(service().assertHuman('token', 'contact')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

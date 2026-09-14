import { loadConfig } from './config';

describe('loadConfig', () => {
  it('reads notification recipients as a comma-separated list', () => {
    const config = loadConfig({ CONTACT_ADMIN_EMAILS: ' a@example.com, b@example.com,' });
    expect(config.contactAdminEmails).toEqual(['a@example.com', 'b@example.com']);
  });

  it('has no recipients when unset', () => {
    expect(loadConfig({}).contactAdminEmails).toEqual([]);
  });
});

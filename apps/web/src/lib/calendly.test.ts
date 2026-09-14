import { describe, expect, it } from 'vitest';
import { calendlyEmbedUrl, isEventScheduled } from './calendly';

describe('calendlyEmbedUrl', () => {
  it('accepts Calendly scheduling links', () => {
    expect(calendlyEmbedUrl('https://calendly.com/hiddengemnc')).toBe(
      'https://calendly.com/hiddengemnc',
    );
    expect(calendlyEmbedUrl(' https://calendly.com/hiddengemnc/consultation ')).toBe(
      'https://calendly.com/hiddengemnc/consultation',
    );
  });

  it('rejects anything else', () => {
    for (const url of [
      undefined,
      '',
      'https://calendly.com/',
      'http://calendly.com/hiddengemnc',
      'https://calendly.com.example.net/hiddengemnc',
      'https://example.com/calendly.com/hiddengemnc',
      'javascript:alert(1)',
    ]) {
      expect(calendlyEmbedUrl(url)).toBeUndefined();
    }
  });
});

describe('isEventScheduled', () => {
  it('recognises a booking confirmed in the widget', () => {
    expect(
      isEventScheduled({
        origin: 'https://calendly.com',
        data: { event: 'calendly.event_scheduled' },
      }),
    ).toBe(true);
  });

  it('ignores other Calendly events and other senders', () => {
    expect(
      isEventScheduled({ origin: 'https://calendly.com', data: { event: 'calendly.page_height' } }),
    ).toBe(false);
    expect(
      isEventScheduled({
        origin: 'https://example.com',
        data: { event: 'calendly.event_scheduled' },
      }),
    ).toBe(false);
    expect(
      isEventScheduled({ origin: 'https://calendly.com', data: 'calendly.event_scheduled' }),
    ).toBe(false);
  });
});

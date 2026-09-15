import { describe, expect, it } from 'vitest';
import { resolveMeasurementId, trackEvent } from './analytics';

describe('resolveMeasurementId', () => {
  it('turns analytics on for deployed builds (dev and prod) with a valid ID', () => {
    expect(resolveMeasurementId('G-ABC123XYZ', 'prod')).toBe('G-ABC123XYZ');
    expect(resolveMeasurementId(' G-DEF456UVW ', 'dev')).toBe('G-DEF456UVW');
  });

  it('stays off locally, and for missing or malformed IDs', () => {
    expect(resolveMeasurementId('G-ABC123XYZ', 'local')).toBeUndefined();
    expect(resolveMeasurementId('G-ABC123XYZ', undefined)).toBeUndefined();
    expect(resolveMeasurementId(undefined, 'prod')).toBeUndefined();
    expect(resolveMeasurementId('UA-12345-1', 'prod')).toBeUndefined();
    expect(resolveMeasurementId('G-abc"><script>', 'prod')).toBeUndefined();
  });
});

describe('trackEvent', () => {
  it('is a no-op when analytics is not loaded', () => {
    expect(() => trackEvent('generate_lead', { form: 'contact' })).not.toThrow();
  });
});

import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  basicAuthHeader,
  type ViewerRequestOptions,
  viewerRequestCode,
} from '../lib/edge/viewer-request';

type CfResult = {
  statusCode?: number;
  uri?: string;
  headers?: Record<string, { value: string }>;
};

/** Runs the generated CloudFront Function source in an isolated context. */
function run(
  options: ViewerRequestOptions,
  request: { uri: string; host?: string; auth?: string; querystring?: object },
): CfResult {
  const sandbox: { handler?: (event: unknown) => CfResult } = {};
  runInNewContext(`${viewerRequestCode(options)}\nthis.handler = handler;`, sandbox);
  const headers: Record<string, { value: string }> = {
    host: { value: request.host ?? 'example.com' },
  };
  if (request.auth) headers.authorization = { value: request.auth };
  return sandbox.handler!({
    request: { uri: request.uri, headers, querystring: request.querystring ?? {} },
  });
}

describe('viewer-request function', () => {
  it.each([
    ['/', '/index.html'],
    ['/about', '/about/index.html'],
    ['/about/', '/about/index.html'],
    ['/assets/app-1a2b.js', '/assets/app-1a2b.js'],
    ['/robots.txt', '/robots.txt'],
  ])('rewrites %s to %s', (uri, expected) => {
    expect(run({}, { uri }).uri).toBe(expected);
  });

  describe('basic auth', () => {
    const expectedAuthorization = basicAuthHeader('hiddengem', 's3cret');

    it('challenges requests without credentials', () => {
      const result = run({ expectedAuthorization }, { uri: '/' });
      expect(result.statusCode).toBe(401);
      expect(result.headers?.['www-authenticate'].value).toContain('Basic realm=');
    });

    it('rejects wrong credentials', () => {
      const result = run(
        { expectedAuthorization },
        { uri: '/', auth: basicAuthHeader('hiddengem', 'nope') },
      );
      expect(result.statusCode).toBe(401);
    });

    it('lets the right credentials through', () => {
      expect(
        run({ expectedAuthorization }, { uri: '/about', auth: expectedAuthorization }).uri,
      ).toBe('/about/index.html');
    });
  });

  describe('canonical host', () => {
    const options = {
      canonicalHost: 'hiddengemnc.com',
      redirectHosts: ['www.hiddengemnc.com'],
    };

    it('301s www to the apex, keeping path and query', () => {
      const result = run(options, {
        uri: '/about',
        host: 'www.hiddengemnc.com',
        querystring: {
          utm_source: { value: 'x' },
          a: { value: '1', multiValue: [{ value: '1' }, { value: '2' }] },
        },
      });
      expect(result.statusCode).toBe(301);
      expect(result.headers?.location.value).toBe(
        'https://hiddengemnc.com/about?utm_source=x&a=1&a=2',
      );
    });

    it('serves the apex normally', () => {
      expect(run(options, { uri: '/', host: 'hiddengemnc.com' }).uri).toBe('/index.html');
    });
  });
});

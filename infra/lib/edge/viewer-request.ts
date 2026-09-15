/**
 * Source for the CloudFront Function on the site's viewer-request event. One
 * function handles all three jobs because CloudFront allows one per event:
 *
 *   1. Basic auth (dev preview): anything without the right Authorization
 *      header gets a 401 and the browser's login prompt.
 *   2. Canonical host: e.g. www.hiddengemnc.com → 301 → hiddengemnc.com.
 *   3. Directory index: /about → /about/index.html. The build prerenders each
 *      route to <route>/index.html, and an S3 origin only serves exact keys.
 *
 * Only the default (S3) behavior uses it — /api/* goes straight to the API.
 *
 * The CloudFront Functions runtime is not Node: keep this ES5-style (var,
 * indexOf, no arrow functions) and dependency-free. test/viewer-request.test.ts
 * executes the generated code.
 */
export interface ViewerRequestOptions {
  /** Exact `Authorization` header value required, e.g. "Basic dXNlcjpwYXNz". */
  expectedAuthorization?: string;
  /** Hostname every other hostname in `redirectHosts` 301s to. */
  canonicalHost?: string;
  redirectHosts?: string[];
  /** Realm shown in the browser's login prompt. */
  realm?: string;
}

export function basicAuthHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

export function viewerRequestCode(options: ViewerRequestOptions): string {
  return `
var EXPECTED_AUTH = ${JSON.stringify(options.expectedAuthorization ?? null)};
var REALM = ${JSON.stringify(options.realm ?? 'Restricted')};
var CANONICAL_HOST = ${JSON.stringify(options.canonicalHost ?? null)};
var REDIRECT_HOSTS = ${JSON.stringify(options.redirectHosts ?? [])};

function queryString(qs) {
  var parts = [];
  for (var key in qs) {
    var entry = qs[key];
    if (entry.multiValue) {
      for (var i = 0; i < entry.multiValue.length; i++) {
        parts.push(key + '=' + entry.multiValue[i].value);
      }
    } else {
      parts.push(entry.value === '' ? key : key + '=' + entry.value);
    }
  }
  return parts.length ? '?' + parts.join('&') : '';
}

function rewriteUri(uri) {
  if (uri.charAt(uri.length - 1) === '/') {
    return uri + 'index.html';
  }
  // A dot in the last segment means a real file (/assets/app.js, /robots.txt).
  var last = uri.substring(uri.lastIndexOf('/') + 1);
  return last.indexOf('.') === -1 ? uri + '/index.html' : uri;
}

function handler(event) {
  var request = event.request;
  var headers = request.headers;

  if (EXPECTED_AUTH !== null) {
    var auth = headers.authorization ? headers.authorization.value : '';
    if (auth !== EXPECTED_AUTH) {
      return {
        statusCode: 401,
        statusDescription: 'Unauthorized',
        headers: {
          'www-authenticate': { value: 'Basic realm="' + REALM + '", charset="UTF-8"' },
          'cache-control': { value: 'no-store' }
        }
      };
    }
  }

  var host = headers.host ? headers.host.value : '';
  if (CANONICAL_HOST && REDIRECT_HOSTS.indexOf(host) !== -1) {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: {
        location: { value: 'https://' + CANONICAL_HOST + request.uri + queryString(request.querystring) }
      }
    };
  }

  request.uri = rewriteUri(request.uri);
  return request;
}
`.trim();
}

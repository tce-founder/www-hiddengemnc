/**
 * Invokes the API Lambda bundle exactly as CDK packaged it (the esbuild asset
 * in cdk.out) with API Gateway events, and fails if it misbehaves.
 *
 * This is the check that catches missing decorator metadata: a bundle built
 * without it still synthesizes and even boots, but Nest's ValidationPipe then
 * silently skips request validation. Here an invalid body must produce a 400.
 *
 *   node infra/scripts/smoke-lambda-bundle.mjs [cdk.out dir]   (default: infra/cdk.out/dev)
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.resolve(process.argv[2] ?? path.join(repoRoot, 'infra/cdk.out/dev'));

// The bundle leaves @aws-sdk/* to the Lambda runtime. Re-run with NODE_PATH
// pointing at the API's dependencies so those requires resolve locally.
if (!process.env.SMOKE_CHILD) {
  const { status } = spawnSync(process.execPath, [fileURLToPath(import.meta.url), outDir], {
    stdio: 'inherit',
    env: {
      ...process.env,
      SMOKE_CHILD: '1',
      NODE_PATH: path.join(repoRoot, 'apps/api/node_modules'),
    },
  });
  process.exit(status ?? 1);
}

function fail(message) {
  console.error(`\n[smoke] FAIL: ${message}\n`);
  process.exit(1);
}

const templateFile = readdirSync(outDir).find((f) => /-Backend\.template\.json$/.test(f));
if (!templateFile) fail(`no *-Backend.template.json in ${outDir} — run \`pnpm synth\` first`);

const template = JSON.parse(readFileSync(path.join(outDir, templateFile), 'utf8'));
const apiFunction = Object.values(template.Resources).find(
  (r) => r.Type === 'AWS::Lambda::Function' && r.Properties?.Handler === 'index.handler',
);
const assetPath = apiFunction?.Metadata?.['aws:asset:path'];
if (!assetPath) fail(`could not find the API function's asset in ${templateFile}`);

const SECRET = 'smoke-origin-secret';
Object.assign(process.env, {
  API_ORIGIN_SECRET: SECRET,
  CONTACT_DRY_RUN: 'true',
  ALLOW_UNVERIFIED_SUBMISSIONS: 'true',
});

const bundle = path.join(outDir, assetPath, 'index.js');
const { handler } = createRequire(import.meta.url)(bundle);
console.log(`[smoke] ${path.relative(repoRoot, bundle)}`);

function event(method, apiPath, { body, headers = {} } = {}) {
  const allHeaders = { 'content-type': 'application/json', ...headers };
  return {
    resource: '/{proxy+}',
    path: apiPath,
    httpMethod: method,
    headers: allHeaders,
    multiValueHeaders: Object.fromEntries(Object.entries(allHeaders).map(([k, v]) => [k, [v]])),
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: { proxy: apiPath.slice(1) },
    stageVariables: null,
    requestContext: {
      httpMethod: method,
      path: `/v1${apiPath}`,
      stage: 'v1',
      requestId: 'smoke',
      resourcePath: '/{proxy+}',
      identity: { sourceIp: '127.0.0.1' },
    },
    body: body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body),
    isBase64Encoded: false,
  };
}

const edge = { 'x-origin-verify': SECRET };
const valid = {
  name: 'Smoke Test',
  email: 'smoke@example.com',
  message: 'Checking the bundled Lambda handles a real request.',
};

const cases = [
  ['health without origin header', event('GET', '/api/health'), 401],
  ['health through CloudFront', event('GET', '/api/health', { headers: edge }), 200],
  ['valid contact submission', event('POST', '/api/contact', { headers: edge, body: valid }), 201],
  [
    'invalid body is rejected (validation ran)',
    event('POST', '/api/contact', { headers: edge, body: { ...valid, email: 'nope' } }),
    400,
  ],
  [
    'unknown field is rejected (whitelist ran)',
    event('POST', '/api/contact', { headers: edge, body: { ...valid, admin: true } }),
    400,
  ],
];

let failed = 0;
for (const [name, evt, expected] of cases) {
  const res = await handler(evt, { callbackWaitsForEmptyEventLoop: true });
  const ok = res.statusCode === expected;
  failed += ok ? 0 : 1;
  console.log(
    `[smoke] ${ok ? 'ok  ' : 'FAIL'} ${name}: ${res.statusCode}${ok ? '' : ` (expected ${expected}) ${res.body}`}`,
  );
}

if (failed) fail(`${failed} case(s) failed`);
console.log('[smoke] bundle OK');

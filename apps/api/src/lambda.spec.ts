import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

/**
 * Drives the real Lambda handler (serverless-express + Nest) with API Gateway
 * proxy events, the same shape CloudFront → API Gateway delivers in AWS.
 * infra/scripts/smoke-lambda-bundle.mjs repeats the key cases against the
 * esbuild bundle CDK actually deploys.
 */
const ORIGIN_SECRET = 'test-origin-secret';

function apiEvent(
  method: 'GET' | 'POST',
  path: string,
  options: { body?: unknown; headers?: Record<string, string> } = {},
): APIGatewayProxyEvent {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-forwarded-for': '203.0.113.7, 198.51.100.1',
    ...options.headers,
  };
  const body =
    options.body === undefined
      ? null
      : typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body);

  return {
    resource: '/{proxy+}',
    path,
    httpMethod: method,
    headers,
    multiValueHeaders: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, [v]])),
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: { proxy: path.replace(/^\//, '') },
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test',
      httpMethod: method,
      path: `/v1${path}`,
      protocol: 'HTTP/1.1',
      requestId: 'test-request',
      requestTimeEpoch: Date.now(),
      resourceId: 'test',
      resourcePath: '/{proxy+}',
      stage: 'v1',
      identity: { sourceIp: '198.51.100.1', userAgent: 'jest' },
    } as APIGatewayProxyEvent['requestContext'],
    body,
    isBase64Encoded: false,
  };
}

const fromEdge = { 'x-origin-verify': ORIGIN_SECRET };

const validSubmission = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  organization: 'Analytical Engines',
  topic: 'General enquiry',
  message: 'Hello — I would like to learn more about your work.',
  source: 'contact-page',
};

describe('Lambda handler', () => {
  let invoke: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

  beforeAll(async () => {
    process.env.API_ORIGIN_SECRET = ORIGIN_SECRET;
    process.env.CONTACT_DRY_RUN = 'true';
    process.env.ALLOW_UNVERIFIED_SUBMISSIONS = 'true';

    // Imported after the environment is set: config is read at bootstrap.
    const { handler } = await import('./lambda');
    invoke = (event) => handler(event, { callbackWaitsForEmptyEventLoop: true } as Context);
  });

  it('rejects requests that did not come through CloudFront', async () => {
    const res = await invoke(apiEvent('GET', '/api/health'));
    expect(res.statusCode).toBe(401);
  });

  it('serves the health check through CloudFront', async () => {
    const res = await invoke(apiEvent('GET', '/api/health', { headers: fromEdge }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ status: 'ok' });
  });

  it('accepts a valid contact submission', async () => {
    const res = await invoke(
      apiEvent('POST', '/api/contact', { headers: fromEdge, body: validSubmission }),
    );
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.submissionId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rejects an invalid submission with field errors', async () => {
    const res = await invoke(
      apiEvent('POST', '/api/contact', {
        headers: fromEdge,
        body: { ...validSubmission, email: 'not-an-email', message: 'short' },
      }),
    );
    expect(res.statusCode).toBe(400);
    const { message } = JSON.parse(res.body);
    expect(message).toEqual(
      expect.arrayContaining([expect.stringMatching(/email/), expect.stringMatching(/message/)]),
    );
  });

  it('rejects unknown fields', async () => {
    const res = await invoke(
      apiEvent('POST', '/api/contact', {
        headers: fromEdge,
        body: { ...validSubmission, isAdmin: true },
      }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('rejects a body that is not JSON', async () => {
    const res = await invoke(
      apiEvent('POST', '/api/contact', { headers: fromEdge, body: 'name=ada' }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('rejects a submission without the origin header', async () => {
    const res = await invoke(apiEvent('POST', '/api/contact', { body: validSubmission }));
    expect(res.statusCode).toBe(401);
  });
});

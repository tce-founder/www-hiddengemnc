import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import type { EnvName, resourceNames } from './config';

const REPO_ROOT = path.resolve(__dirname, '../..');

/**
 * The Lambda is bundled from tsc's output, not from src. esbuild can't emit
 * the decorator metadata Nest relies on, and without it dependency injection
 * fails and — worse — ValidationPipe silently skips validating request bodies.
 * infra/scripts/smoke-lambda-bundle.mjs checks the bundled result in CI.
 */
export const API_ENTRY = path.join(REPO_ROOT, 'apps/api/dist/lambda.js');

interface BackendStackProps extends cdk.StackProps {
  envName: EnvName;
  names: ReturnType<typeof resourceNames>;
  publicSiteUrl: string;
  sesFromAddress: string;
  contactAdminEmails: string[];
  /** Email submitters an acknowledgement (sendConfirmationEmail in cdk.json). */
  sendConfirmationEmail: boolean;
  recaptchaSecretKey: string;
}

/**
 * Contact API: API Gateway (REST, regional) → Lambda (NestJS) → DynamoDB + SES.
 *
 * Browsers never call API Gateway directly. CloudFront routes /api/* here and
 * adds an `x-origin-verify` header whose value is a CDK-generated secret; the
 * API rejects any request without it, so the execute-api URL is useless on its
 * own. There is no CORS configuration because every call is same-origin.
 */
export class BackendStack extends cdk.Stack {
  readonly restApi: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);
    const { envName, names } = props;
    const isProd = envName === 'prod';

    if (!existsSync(API_ENTRY)) {
      throw new Error(
        `API build output not found at ${API_ENTRY}.\nRun \`pnpm build\` (or \`pnpm nx build api\`) before synthesizing.`,
      );
    }

    const originSecret = new secretsmanager.Secret(this, 'OriginSecret', {
      secretName: names.originSecretName,
      description:
        'Value CloudFront sends as x-origin-verify; the API rejects requests without it.',
      generateSecretString: { passwordLength: 48, excludePunctuation: true },
    });

    const submissions = new dynamodb.TableV2(this, 'Submissions', {
      tableName: `hiddengem-contact-submissions-${envName}`,
      partitionKey: { name: 'submissionId', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'ttl',
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: isProd },
      deletionProtection: isProd,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const logGroup = new logs.LogGroup(this, 'ApiLogs', {
      logGroupName: `/aws/lambda/hiddengem-api-${envName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const fn = new NodejsFunction(this, 'ApiFunction', {
      functionName: `hiddengem-api-${envName}`,
      description: 'hiddengemnc.com contact API (NestJS)',
      entry: API_ENTRY,
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: cdk.Duration.seconds(15),
      logGroup,
      // Bundling runs `pnpm exec esbuild` in this directory, so esbuild is a
      // devDependency of the repo root, not of infra.
      projectRoot: REPO_ROOT,
      depsLockFilePath: path.join(REPO_ROOT, 'pnpm-lock.yaml'),
      bundling: {
        format: OutputFormat.CJS,
        target: 'node24',
        minify: true,
        sourceMap: true,
        keepNames: true,
        // AWS SDK v3 ships with the runtime. The Nest packages are optional
        // peers Nest probes for at startup; they are not installed.
        externalModules: [
          '@aws-sdk/*',
          '@nestjs/microservices',
          '@nestjs/microservices/microservices-module',
          '@nestjs/websockets',
          '@nestjs/websockets/socket-module',
        ],
      },
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        SITE_NAME: 'Hidden Gem NC',
        PUBLIC_SITE_URL: props.publicSiteUrl,
        SUBMISSIONS_TABLE: submissions.tableName,
        SES_FROM_ADDRESS: props.sesFromAddress,
        CONTACT_ADMIN_EMAILS: props.contactAdminEmails.join(','),
        SEND_CONFIRMATION_EMAIL: String(props.sendConfirmationEmail),
        // Empty = every submission is rejected (fail closed) until configured.
        RECAPTCHA_SECRET_KEY: props.recaptchaSecretKey,
        // Resolved by CloudFormation at deploy time; never in the template or repo.
        API_ORIGIN_SECRET: originSecret.secretValue.unsafeUnwrap(),
      },
    });

    submissions.grants.writeData(fn);
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'SendAsSiteAddressOnly',
        actions: ['ses:SendEmail'],
        resources: [
          `arn:aws:ses:${this.region}:${this.account}:identity/*`,
          `arn:aws:ses:${this.region}:${this.account}:configuration-set/*`,
        ],
        conditions: { StringEquals: { 'ses:FromAddress': props.sesFromAddress } },
      }),
    );

    this.restApi = new apigateway.RestApi(this, 'RestApi', {
      restApiName: `hiddengem-api-${envName}`,
      description: 'hiddengemnc.com contact API (reached only through CloudFront /api/*)',
      // Regional, not edge-optimized: CloudFront is already in front of it.
      endpointTypes: [apigateway.EndpointType.REGIONAL],
      cloudWatchRole: false,
      deployOptions: {
        stageName: 'v1',
        // The API's own rate limit, and its only one while WAF is off
        // (cdk.json). A contact form needs far less than this.
        throttlingRateLimit: 5,
        throttlingBurstLimit: 10,
      },
    });
    this.restApi.root.addProxy({ defaultIntegration: new apigateway.LambdaIntegration(fn) });

    new cdk.CfnOutput(this, 'ApiFunctionName', { value: fn.functionName });
    new cdk.CfnOutput(this, 'SubmissionsTable', { value: submissions.tableName });
  }
}

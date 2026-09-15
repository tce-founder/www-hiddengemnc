import * as cdk from 'aws-cdk-lib';
import type * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import type { Construct } from 'constructs';
import type { EnvName, resourceNames, SiteConfig } from './config';
import { basicAuthHeader, viewerRequestCode } from './edge/viewer-request';

interface FrontendStackProps extends cdk.StackProps {
  envName: EnvName;
  names: ReturnType<typeof resourceNames>;
  site: SiteConfig;
  /** Zone for the certificate-validation and alias records (site.dnsZone in cdk.json). */
  zone: route53.IHostedZone;
  restApi: apigateway.RestApi;
  enableWaf: boolean;
  basicAuth?: { username: string; password: string };
}

/**
 * The website: a private S3 bucket behind CloudFront (Origin Access Control),
 * with /api/* routed to the Backend's API Gateway on the same hostname.
 *
 * Content is not deployed here — the workflow syncs apps/web/dist to the
 * bucket and invalidates the cache after `cdk deploy`, so cache headers can
 * differ between hashed assets and HTML.
 */
export class FrontendStack extends cdk.Stack {
  readonly distribution: cloudfront.Distribution;
  readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);
    const { envName, names, site, zone } = props;
    const isProd = envName === 'prod';
    // Only production may be indexed; dev tells crawlers to stay away.
    const indexable = isProd;

    this.bucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: names.siteBucket,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: isProd,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    const logBucket = new s3.Bucket(this, 'AccessLogBucket', {
      bucketName: `${names.siteBucket}-logs`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // CloudFront standard logging writes with ACLs.
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
      lifecycleRules: [{ expiration: cdk.Duration.days(90) }],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const viewerRequest = new cloudfront.Function(this, 'ViewerRequestFunction', {
      functionName: `hiddengem-${envName}-viewer-request`,
      comment: 'Basic auth (dev), canonical-host redirect, directory-index rewrite',
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(
        viewerRequestCode({
          expectedAuthorization: props.basicAuth
            ? basicAuthHeader(props.basicAuth.username, props.basicAuth.password)
            : undefined,
          realm: `Hidden Gem NC (${envName})`,
          canonicalHost: site.domain,
          redirectHosts: site.aliases.slice(1),
        }),
      ),
    });

    const responseHeaders = new cloudfront.ResponseHeadersPolicy(this, 'ResponseHeaders', {
      responseHeadersPolicyName: `hiddengem-${envName}-headers`,
      securityHeadersBehavior: {
        // No includeSubDomains: leaves other hiddengemnc.com subdomains free to
        // point at third-party services.
        strictTransportSecurity: { accessControlMaxAge: cdk.Duration.days(365), override: true },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
      },
      customHeadersBehavior: {
        customHeaders: [
          {
            header: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
            override: true,
          },
          ...(indexable
            ? []
            : [{ header: 'X-Robots-Tag', value: 'noindex, nofollow', override: true }]),
        ],
      },
    });

    // Forward only what the API needs. Leaving out Authorization matters on
    // dev: the browser attaches the basic-auth header to same-origin requests.
    const apiOriginRequest = new cloudfront.OriginRequestPolicy(this, 'ApiOriginRequest', {
      originRequestPolicyName: `hiddengem-${envName}-api`,
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
        'Accept',
        'Accept-Language',
        'Content-Type',
        'Referer',
        'User-Agent',
      ),
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
      cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
    });

    const apiOrigin = new origins.RestApiOrigin(props.restApi, {
      // CloudFront overwrites any viewer-supplied header with the same name,
      // so this can't be forged from outside. Read by name (a CloudFormation
      // dynamic reference) so the value never appears in the template.
      customHeaders: {
        'x-origin-verify': cdk.SecretValue.secretsManager(names.originSecretName).unsafeUnwrap(),
      },
    });

    // Validated by DNS in the site's zone, so issuing and renewing need no manual steps.
    const certificate = new acm.Certificate(this, 'Certificate', {
      domainName: site.domain,
      subjectAlternativeNames: site.aliases.slice(1),
      validation: acm.CertificateValidation.fromDns(zone),
    });

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `hiddengemnc.com (${envName})`,
      defaultRootObject: 'index.html',
      certificate,
      domainNames: site.aliases,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      enableIpv6: true,
      enableLogging: true,
      logBucket,
      logFilePrefix: 'cloudfront/',
      webAclId: props.enableWaf ? this.webAcl(envName).attrArn : undefined,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: responseHeaders,
        compress: true,
        functionAssociations: [
          { function: viewerRequest, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
        ],
      },
      additionalBehaviors: {
        '/api/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: apiOriginRequest,
          responseHeadersPolicy: responseHeaders,
        },
      },
      // Unknown paths get the prerendered 404 page with a real 404 status
      // (S3 reports a missing key as 403 because the bucket isn't listable).
      errorResponses: [403, 404].map((httpStatus) => ({
        httpStatus,
        responseHttpStatus: 404,
        responsePagePath: '/404.html',
        ttl: cdk.Duration.minutes(1),
      })),
    });

    const target = route53.RecordTarget.fromAlias(
      new route53Targets.CloudFrontTarget(this.distribution),
    );
    site.aliases.forEach((recordName, i) => {
      new route53.ARecord(this, `AliasA${i}`, { zone, recordName, target });
      new route53.AaaaRecord(this, `AliasAaaa${i}`, { zone, recordName, target });
    });

    // Read by the deploy workflow to find where to upload and what to invalidate.
    new ssm.StringParameter(this, 'SiteBucketParam', {
      parameterName: `${names.ssmPrefix}/site-bucket`,
      stringValue: this.bucket.bucketName,
    });
    new ssm.StringParameter(this, 'DistributionIdParam', {
      parameterName: `${names.ssmPrefix}/distribution-id`,
      stringValue: this.distribution.distributionId,
    });

    new cdk.CfnOutput(this, 'SiteUrl', { value: `https://${site.domain}` });
    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'Alias target of the site hostnames',
    });
    new cdk.CfnOutput(this, 'DistributionId', { value: this.distribution.distributionId });
  }

  private webAcl(envName: EnvName): wafv2.CfnWebACL {
    const visibility = (metricName: string) => ({
      cloudWatchMetricsEnabled: true,
      sampledRequestsEnabled: true,
      metricName: `hiddengem-${envName}-${metricName}`,
    });
    const managed = (
      name: string,
      priority: number,
      ruleActionOverrides?: wafv2.CfnWebACL.RuleActionOverrideProperty[],
    ): wafv2.CfnWebACL.RuleProperty => ({
      name,
      priority,
      overrideAction: { none: {} },
      statement: { managedRuleGroupStatement: { vendorName: 'AWS', name, ruleActionOverrides } },
      visibilityConfig: visibility(name),
    });
    const rateLimited = {
      block: { customResponse: { responseCode: 429, customResponseBodyKey: 'rate-limited' } },
    };

    // CLOUDFRONT-scoped ACLs must live in us-east-1 — as this stack does.
    return new wafv2.CfnWebACL(this, 'WebAcl', {
      name: `hiddengem-${envName}-site`,
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: visibility('web-acl'),
      customResponseBodies: {
        'rate-limited': {
          contentType: 'APPLICATION_JSON',
          content: '{"statusCode":429,"message":"Too many requests"}',
        },
      },
      rules: [
        managed('AWSManagedRulesAmazonIpReputationList', 0),
        // Count, not block, oversize bodies: a 5,000-character message in a
        // non-Latin script can exceed the rule's 8 KB limit. The API caps size.
        managed('AWSManagedRulesCommonRuleSet', 1, [
          { name: 'SizeRestrictions_BODY', actionToUse: { count: {} } },
        ]),
        managed('AWSManagedRulesKnownBadInputsRuleSet', 2),
        {
          name: 'ApiRateLimit',
          priority: 3,
          action: rateLimited,
          statement: {
            rateBasedStatement: {
              limit: 30,
              evaluationWindowSec: 300,
              aggregateKeyType: 'IP',
              scopeDownStatement: {
                byteMatchStatement: {
                  fieldToMatch: { uriPath: {} },
                  positionalConstraint: 'STARTS_WITH',
                  searchString: '/api/',
                  textTransformations: [{ priority: 0, type: 'NONE' }],
                },
              },
            },
          },
          visibilityConfig: visibility('api-rate-limit'),
        },
        {
          name: 'SiteRateLimit',
          priority: 4,
          action: rateLimited,
          statement: { rateBasedStatement: { limit: 2000, aggregateKeyType: 'IP' } },
          visibilityConfig: visibility('site-rate-limit'),
        },
      ],
    });
  }
}

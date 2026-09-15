import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../lib/app';
import type { ProjectConfig } from '../lib/config';

const cdkJson = JSON.parse(readFileSync(path.join(__dirname, '../cdk.json'), 'utf8'));
const config: ProjectConfig = cdkJson.context.hiddengem;
const account = config.environments.dev.account;

/** Source of the site's viewer-request CloudFront Function. */
function functionCode(template: Template): string {
  const [fn] = Object.values(template.findResources('AWS::CloudFront::Function'));
  return (fn as { Properties: { FunctionCode: string } }).Properties.FunctionCode;
}

function synth(env: 'dev' | 'prod', edit?: (config: ProjectConfig) => void) {
  const project: ProjectConfig = structuredClone(config);
  edit?.(project);
  const app = new cdk.App({
    context: {
      ...cdkJson.context,
      hiddengem: project,
      env,
      // Skip esbuild: these tests check infrastructure, not the bundle
      // (infra/scripts/smoke-lambda-bundle.mjs covers that).
      'aws:cdk:bundling-stacks': [],
    },
  });
  const stacks = buildApp(app, { basicAuthPassword: 'test-password' });
  return {
    oidc: stacks.oidc ? Template.fromStack(stacks.oidc) : undefined,
    dns: Template.fromStack(stacks.dns),
    backend: Template.fromStack(stacks.backend),
    frontend: Template.fromStack(stacks.frontend),
    email: Template.fromStack(stacks.email),
  };
}

describe('GitHub OIDC deploy roles', () => {
  const oidc = synth('prod').oidc!;

  it.each(['dev', 'prod'] as const)('trusts only this repo in the %s GitHub Environment', (env) => {
    oidc.hasResourceProperties('AWS::IAM::Role', {
      RoleName: `hiddengem-${env}-github-deploy`,
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRoleWithWebIdentity',
            Effect: 'Allow',
            Condition: {
              StringEquals: {
                'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
                'token.actions.githubusercontent.com:sub': [
                  `repo:tce-founder/www-hiddengemnc:environment:${env}`,
                  `repo:tce-founder@290369619/www-hiddengemnc@1370545461:environment:${env}`,
                ],
              },
            },
          },
        ],
      },
    });
  });

  it("holds the account's one GitHub OIDC provider", () => {
    oidc.resourceCountIs('AWS::IAM::OIDCProvider', 1);
  });

  it('never uses a wildcard subject', () => {
    const roles = JSON.stringify(oidc.findResources('AWS::IAM::Role'));
    expect(roles).not.toMatch(/githubusercontent\.com:sub"[^\]]*\*/);
    expect(roles).not.toContain('StringLike');
  });

  it('is deployed by the prod pipeline only', () => {
    expect(synth('dev').oidc).toBeUndefined();
  });
});

describe.each(['dev', 'prod'] as const)('%s hosted zone', (env) => {
  const { dns } = synth(env);
  const zoneName = config.environments[env].hostedZone;

  it(`creates ${zoneName} and delegates it from the apex zone`, () => {
    dns.hasResourceProperties('AWS::Route53::HostedZone', { Name: `${zoneName}.` });
    dns.hasResourceProperties('AWS::Route53::RecordSet', {
      HostedZoneId: config.apexZoneId,
      Name: `${zoneName}.`,
      Type: 'NS',
    });
  });

  it('never creates or replaces the apex zone', () => {
    dns.resourceCountIs('AWS::Route53::HostedZone', 1);
  });
});

describe('dev frontend', () => {
  const { frontend } = synth('dev');

  it('serves www.d.hiddengemnc.com over TLS, without WAF', () => {
    frontend.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        Aliases: ['www.d.hiddengemnc.com'],
        WebACLId: Match.absent(),
        ViewerCertificate: Match.objectLike({ MinimumProtocolVersion: 'TLSv1.2_2021' }),
      }),
    });
    frontend.resourceCountIs('AWS::WAFv2::WebACL', 0);
  });

  it('keeps the bucket private and TLS-only', () => {
    frontend.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: `hiddengem-www-dev-${account}`,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
    frontend.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
  });

  it('password-protects the site and tells crawlers to stay away', () => {
    expect(functionCode(frontend)).toContain('var EXPECTED_AUTH = "Basic ');
    frontend.hasResourceProperties('AWS::CloudFront::ResponseHeadersPolicy', {
      ResponseHeadersPolicyConfig: Match.objectLike({
        CustomHeadersConfig: {
          Items: Match.arrayWith([Match.objectLike({ Header: 'X-Robots-Tag' })]),
        },
      }),
    });
  });

  it('injects the origin secret by reference, not by value', () => {
    const json = JSON.stringify(frontend.findResources('AWS::CloudFront::Distribution'));
    expect(json).toContain('x-origin-verify');
    expect(json).toContain('{{resolve:secretsmanager:hiddengem/dev/api-origin-secret');
  });
});

describe('prod frontend', () => {
  const { frontend } = synth('prod');

  it('serves the apex and www with a certificate validated in the apex zone', () => {
    frontend.hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainName: 'hiddengemnc.com',
      SubjectAlternativeNames: ['www.hiddengemnc.com'],
      DomainValidationOptions: Match.arrayWith([
        Match.objectLike({ DomainName: 'hiddengemnc.com', HostedZoneId: config.apexZoneId }),
      ]),
    });
    frontend.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        Aliases: ['hiddengemnc.com', 'www.hiddengemnc.com'],
      }),
    });
  });

  it('points both names at the distribution from the apex zone', () => {
    for (const Name of ['hiddengemnc.com.', 'www.hiddengemnc.com.']) {
      for (const Type of ['A', 'AAAA']) {
        frontend.hasResourceProperties('AWS::Route53::RecordSet', {
          HostedZoneId: config.apexZoneId,
          Name,
          Type,
        });
      }
    }
  });

  it('is public, redirects www to the apex, and is indexable', () => {
    expect(functionCode(frontend)).toContain('var EXPECTED_AUTH = null');
    expect(functionCode(frontend)).toContain('var CANONICAL_HOST = "hiddengemnc.com"');
    expect(functionCode(frontend)).toContain('var REDIRECT_HOSTS = ["www.hiddengemnc.com"]');
    expect(
      JSON.stringify(frontend.findResources('AWS::CloudFront::ResponseHeadersPolicy')),
    ).not.toContain('X-Robots-Tag');
  });

  it('attaches the WAF when it is switched on', () => {
    const { frontend: withWaf } = synth('prod', (project) => {
      project.environments.prod.waf = true;
    });
    withWaf.resourceCountIs('AWS::WAFv2::WebACL', 1);
    withWaf.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({ WebACLId: Match.anyValue() }),
    });
  });
});

describe('backend', () => {
  const { backend } = synth('dev');

  it('runs the API on Node.js 24 / arm64', () => {
    backend.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs24.x',
      Architectures: ['arm64'],
    });
  });

  it('never puts the origin secret in the template', () => {
    backend.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          API_ORIGIN_SECRET: Match.objectLike({ 'Fn::Join': Match.anyValue() }),
        }),
      },
    });
    const json = JSON.stringify(backend.findResources('AWS::Lambda::Function'));
    expect(json).toContain('{{resolve:secretsmanager:');
  });

  it('may only send email as the site address', () => {
    backend.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'ses:SendEmail',
            Condition: { StringEquals: { 'ses:FromAddress': 'noreply@d.hiddengemnc.com' } },
          }),
        ]),
      },
    });
  });
});

describe.each(['dev', 'prod'] as const)('%s contact notifications', (env) => {
  const { email, backend } = synth(env);
  const { contactAdminEmails, sendConfirmationEmail, emailDomain } = config.environments[env];

  it('gives the API the recipients and the acknowledgement switch', () => {
    backend.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          CONTACT_ADMIN_EMAILS: contactAdminEmails.join(','),
          SEND_CONFIRMATION_EMAIL: String(sendConfirmationEmail),
        }),
      },
    });
  });

  it('creates only its own sending domain in SES', () => {
    email.resourceCountIs('AWS::SES::EmailIdentity', 1);
    email.hasResourceProperties('AWS::SES::EmailIdentity', { EmailIdentity: emailDomain });
  });
});

describe('config', () => {
  it('never emails submitters from dev (SES has production access)', () => {
    expect(config.environments.dev.sendConfirmationEmail).toBe(false);
  });

  it('refuses an environment with no notification recipients', () => {
    expect(() =>
      synth('dev', (project) => {
        project.environments.dev.contactAdminEmails = [];
      }),
    ).toThrow(/contactAdminEmails/);
  });

  it('refuses site aliases outside their DNS zone', () => {
    expect(() =>
      synth('prod', (project) => {
        project.environments.prod.site.dnsZone = 'environment';
      }),
    ).toThrow(/every site alias must be inside mail\.hiddengemnc\.com/);
  });

  it('refuses environments in different accounts', () => {
    expect(() =>
      synth('dev', (project) => {
        project.environments.prod.account = '111111111111';
      }),
    ).toThrow(/share one account/);
  });

  it('refuses to deploy the dev preview without a password', () => {
    const app = new cdk.App({
      context: {
        ...cdkJson.context,
        hiddengem: structuredClone(config),
        env: 'dev',
        deploy: 'true',
        'aws:cdk:bundling-stacks': [],
      },
    });
    expect(() => buildApp(app, {})).toThrow(/BASIC_AUTH_PASSWORD/);
  });
});

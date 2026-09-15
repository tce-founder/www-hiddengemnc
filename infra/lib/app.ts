import * as cdk from 'aws-cdk-lib';
import { randomBytes } from 'node:crypto';
import { BackendStack } from './backend-stack';
import { loadConfig, resourceNames, SHARED_OIDC_STACK } from './config';
import { DnsStack } from './dns-stack';
import { EmailStack } from './email-stack';
import { FrontendStack } from './frontend-stack';
import { GithubOidcStack } from './github-oidc-stack';

export interface DeployInputs {
  basicAuthUsername?: string;
  basicAuthPassword?: string;
  recaptchaSecretKey?: string;
}

/**
 * Builds every stack for one environment (`-c env=dev|prod`). Shared by
 * bin/app.ts and the tests.
 *
 * Stacks (dependencies resolve automatically from the references below):
 *   HiddenGem-Shared-GithubOidc  OIDC provider + both deploy roles. In the prod app only.
 *   <Prefix>-Dns                 This environment's hosted zone, delegated from hiddengemnc.com.
 *   <Prefix>-Email               SES sending identity + DKIM/SPF/DMARC records.
 *   <Prefix>-Backend             Contact API: Lambda, API Gateway, DynamoDB, origin secret.
 *   <Prefix>-Frontend            S3 + CloudFront (+ WAF when enabled); /api/* is routed to the Backend.
 */
export function buildApp(app: cdk.App, inputs: DeployInputs = {}) {
  const { project, envName, env } = loadConfig(app);
  const names = resourceNames(envName, env.account);
  const awsEnv: cdk.Environment = { account: env.account, region: env.region };
  const siteUrl = `https://${env.site.domain}`;

  // Both environments' deploy roles live in one stack (one OIDC provider per
  // account). Only the prod app has it, so a change to who may deploy ships
  // through main.
  const oidc =
    envName === 'prod'
      ? new GithubOidcStack(app, SHARED_OIDC_STACK, {
          env: awsEnv,
          description:
            'hiddengemnc.com - GitHub Actions OIDC provider and the dev + prod deploy roles',
          github: project.github,
          environments: {
            dev: resourceNames('dev', project.environments.dev.account),
            prod: names,
          },
        })
      : undefined;

  const dns = new DnsStack(app, `${names.stackPrefix}-Dns`, {
    env: awsEnv,
    description: `hiddengemnc.com (${envName}) - hosted zone ${env.hostedZone}`,
    envName,
    zoneName: env.hostedZone,
    apexDomain: project.apexDomain,
    apexZoneId: project.apexZoneId,
  });

  const sesFromAddress = `noreply@${env.emailDomain}`;
  const email = new EmailStack(app, `${names.stackPrefix}-Email`, {
    env: awsEnv,
    description: `hiddengemnc.com (${envName}) - SES identity ${env.emailDomain}`,
    envName,
    hostedZone: dns.hostedZone,
  });

  const backend = new BackendStack(app, `${names.stackPrefix}-Backend`, {
    env: awsEnv,
    description: `hiddengemnc.com (${envName}) - contact API`,
    envName,
    names,
    publicSiteUrl: siteUrl,
    sesFromAddress,
    contactAdminEmails: env.contactAdminEmails,
    sendConfirmationEmail: env.sendConfirmationEmail,
    recaptchaSecretKey: inputs.recaptchaSecretKey ?? '',
  });
  backend.addStackDependency(email); // the sending identity must exist before the API uses it

  const frontend = new FrontendStack(app, `${names.stackPrefix}-Frontend`, {
    env: awsEnv,
    description: `hiddengemnc.com (${envName}) - website`,
    envName,
    names,
    site: env.site,
    zone: env.site.dnsZone === 'apex' ? dns.apexZone : dns.hostedZone,
    restApi: backend.restApi,
    enableWaf: env.waf,
    basicAuth: env.basicAuth ? resolveBasicAuth(app, inputs) : undefined,
  });
  frontend.addStackDependency(backend); // the origin secret is read by name, not by reference

  cdk.Tags.of(app).add('Project', 'HiddenGem');
  cdk.Tags.of(app).add('Environment', envName);
  cdk.Tags.of(app).add('ManagedBy', 'CDK');
  cdk.Tags.of(app).add('Repository', `${project.github.owner}/${project.github.repo}`);

  return { oidc, dns, email, backend, frontend };
}

/**
 * The dev preview password is baked into the CloudFront Function at synth
 * time. A deploy (`-c deploy=true`, set by the workflow) must supply it; a
 * plain synth — CI checks, tests — gets a random throwaway so nothing
 * guessable can ever be deployed by accident.
 */
function resolveBasicAuth(app: cdk.App, inputs: DeployInputs) {
  const deploying = String(app.node.tryGetContext('deploy')) === 'true';
  if (!inputs.basicAuthPassword && deploying) {
    throw new Error('BASIC_AUTH_PASSWORD must be set to deploy an environment with basicAuth=true');
  }
  return {
    username: inputs.basicAuthUsername || 'hiddengem',
    password: inputs.basicAuthPassword || randomBytes(24).toString('base64url'),
  };
}

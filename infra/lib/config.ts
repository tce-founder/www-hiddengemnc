import type * as cdk from 'aws-cdk-lib';

/**
 * Typed view of the `hiddengem` context block in cdk.json — the one place
 * accounts, domains and per-environment switches are declared.
 */
export type EnvName = 'dev' | 'prod';

const ENV_NAMES: readonly EnvName[] = ['dev', 'prod'];

export interface SiteConfig {
  /** Canonical hostname. The other aliases 301 here. */
  domain: string;
  /** Every hostname the distribution answers to (canonical first). */
  aliases: string[];
  /**
   * Zone that holds the certificate-validation and alias records:
   * `environment` is this environment's own zone (hostedZone, e.g.
   * d.hiddengemnc.com); `apex` is the existing hiddengemnc.com zone.
   */
  dnsZone: 'environment' | 'apex';
}

export interface EnvironmentConfig {
  account: string;
  region: string;
  /** AWS CLI profile for humans running bootstrap scripts; CI uses OIDC instead. */
  profile: string;
  /** This environment's own hosted zone, created by CDK and delegated from the apex zone. */
  hostedZone: string;
  /** SES sending domain; must equal hostedZone so CDK can publish its DKIM records. */
  emailDomain: string;
  /** Recipients of new-enquiry notifications (one message, all in To). */
  contactAdminEmails: string[];
  /**
   * Send submitters an acknowledgement. The account has SES production access,
   * so on dev this would email whoever fills in the form.
   */
  sendConfirmationEmail: boolean;
  /** Password-protect the whole site (dev preview). */
  basicAuth: boolean;
  waf: boolean;
  site: SiteConfig;
}

export interface ProjectConfig {
  github: { owner: string; ownerId: string; repo: string; repoId: string };
  apexDomain: string;
  /** The existing public hosted zone for apexDomain. CDK adds its own records; it never replaces the zone. */
  apexZoneId: string;
  environments: Record<EnvName, EnvironmentConfig>;
}

export interface ResolvedConfig {
  project: ProjectConfig;
  envName: EnvName;
  env: EnvironmentConfig;
}

export function loadConfig(app: cdk.App): ResolvedConfig {
  const project = app.node.tryGetContext('hiddengem') as ProjectConfig | undefined;
  if (!project) {
    throw new Error('cdk.json is missing the "hiddengem" context block');
  }

  const envName = String(app.node.tryGetContext('env') ?? 'dev');
  if (envName !== 'dev' && envName !== 'prod') {
    throw new Error(`Unknown environment "${envName}" — use -c env=dev or -c env=prod`);
  }

  validate(project);
  return { project, envName, env: project.environments[envName] };
}

/** No commas: the list reaches the Lambda as one comma-separated variable. */
const EMAIL_ADDRESS = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

const isWithin = (name: string, zone: string) => name === zone || name.endsWith(`.${zone}`);

/** Checks both environments, whichever one is being synthesized. */
function validate(project: ProjectConfig): void {
  const problems: string[] = [];
  const { dev, prod } = project.environments;
  if (dev.account !== prod.account || dev.region !== prod.region) {
    problems.push(
      'dev and prod must share one account and region: their deploy roles share one GitHub OIDC provider',
    );
  }

  for (const envName of ENV_NAMES) {
    const env = project.environments[envName];
    const problem = (message: string) => problems.push(`${envName}: ${message}`);

    if (!/^\d{12}$/.test(env.account)) problem('account must be a 12-digit AWS account id');
    if (env.hostedZone === project.apexDomain || !isWithin(env.hostedZone, project.apexDomain)) {
      problem(`hostedZone must be a subdomain of ${project.apexDomain}`);
    }
    if (env.emailDomain !== env.hostedZone) problem('emailDomain must equal hostedZone');
    const recipients = env.contactAdminEmails;
    if (
      !Array.isArray(recipients) ||
      recipients.length === 0 ||
      !recipients.every((address) => EMAIL_ADDRESS.test(address))
    ) {
      problem('contactAdminEmails must list at least one email address');
    }
    if (typeof env.sendConfirmationEmail !== 'boolean') {
      problem('sendConfirmationEmail must be true or false');
    }
    if (env.site.aliases[0] !== env.site.domain)
      problem('site.aliases must start with site.domain');
    if (env.site.dnsZone !== 'environment' && env.site.dnsZone !== 'apex') {
      problem('site.dnsZone must be "environment" or "apex"');
    } else {
      const zone = env.site.dnsZone === 'apex' ? project.apexDomain : env.hostedZone;
      if (!env.site.aliases.every((alias) => isWithin(alias, zone))) {
        problem(`every site alias must be inside ${zone} (site.dnsZone is "${env.site.dnsZone}")`);
      }
    }
  }

  if (problems.length) {
    throw new Error(`Invalid cdk.json config:\n  - ${problems.join('\n  - ')}`);
  }
}

/** Resource names shared by more than one stack or script, so they cannot drift. */
export function resourceNames(envName: EnvName, account: string) {
  return {
    stackPrefix: `HiddenGem-${envName === 'dev' ? 'Dev' : 'Prod'}`,
    siteBucket: `hiddengem-www-${envName}-${account}`,
    ssmPrefix: `/hiddengem/${envName}`,
    originSecretName: `hiddengem/${envName}/api-origin-secret`,
    deployRoleName: `hiddengem-${envName}-github-deploy`,
  };
}

/** The stack both environments share: the account's GitHub OIDC provider and both deploy roles. */
export const SHARED_OIDC_STACK = 'HiddenGem-Shared-GithubOidc';

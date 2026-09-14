import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';
import type { EnvName, ProjectConfig, resourceNames } from './config';

type EnvResourceNames = ReturnType<typeof resourceNames>;

interface GithubOidcStackProps extends cdk.StackProps {
  github: ProjectConfig['github'];
  /** Each environment's resource names, which bound what its deploy role can touch directly. */
  environments: Record<EnvName, EnvResourceNames>;
}

/**
 * GitHub Actions → AWS via OIDC: the only way CI authenticates (no access keys).
 *
 * Dev and prod share one AWS account, and IAM allows one OIDC provider per
 * issuer per account, so this one stack holds the provider and both deploy
 * roles. A human deploys it once (scripts/bootstrap/bootstrap-account.sh);
 * after that only the prod pipeline does, so a change to who may deploy ships
 * through `main`.
 *
 * Each role trusts only this repository running in the GitHub Environment of
 * the same name, with `aud = sts.amazonaws.com`. No wildcards: a broad `sub`
 * would let any branch, fork or PR workflow assume the role.
 *
 * GitHub is what keeps dev and prod apart: the `prod` Environment accepts
 * deployments from `main` only. Both roles deploy through the account's shared
 * CDK bootstrap roles, whose CloudFormation execution role is an
 * administrator, so IAM alone does not separate the environments. Only
 * separate accounts would.
 *
 * Both subject formats are trusted: `repo:<owner>/<repo>:…` (GitHub's default)
 * and `repo:<owner>@<ownerId>/<repo>@<repoId>:…` (immutable subjects, which
 * survive a rename). Each matches this repository only.
 *
 * Directly, each role can only (a) assume the CDK bootstrap roles, (b) sync its
 * environment's site bucket, (c) invalidate CloudFront, (d) read its
 * environment's deploy parameters and (e) describe its environment's stacks.
 */
export class GithubOidcStack extends cdk.Stack {
  readonly deployRoles: Record<EnvName, iam.Role>;

  constructor(scope: Construct, id: string, props: GithubOidcStackProps) {
    super(scope, id, props);

    const provider = new iam.OidcProviderNative(this, 'GithubProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
      // AWS no longer checks thumbprints for GitHub's issuer; supplied for older API validation.
      thumbprints: [
        '6938fd4d98bab03faadb97b34396831e3780aea1',
        '1c58a3a8518e8759bf075b76b750d4f2df264fcd',
      ],
    });

    this.deployRoles = {
      dev: this.deployRole(provider, props.github, 'dev', props.environments.dev),
      prod: this.deployRole(provider, props.github, 'prod', props.environments.prod),
    };
  }

  private deployRole(
    provider: iam.OidcProviderNative,
    github: ProjectConfig['github'],
    envName: EnvName,
    names: EnvResourceNames,
  ): iam.Role {
    const label = envName === 'dev' ? 'Dev' : 'Prod';
    const subjects = [
      `repo:${github.owner}/${github.repo}:environment:${envName}`,
      `repo:${github.owner}@${github.ownerId}/${github.repo}@${github.repoId}:environment:${envName}`,
    ];

    const role = new iam.Role(this, `${label}DeployRole`, {
      roleName: names.deployRoleName,
      description: `GitHub Actions (${github.owner}/${github.repo}, environment ${envName}) deploy role`,
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(provider.oidcProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          'token.actions.githubusercontent.com:sub': subjects,
        },
      }),
    });

    role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AssumeCdkBootstrapRoles',
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${this.account}:role/cdk-hnb659fds-*`],
      }),
    );

    const bucketArn = `arn:aws:s3:::${names.siteBucket}`;
    role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'ListSiteBucket',
        actions: ['s3:ListBucket'],
        resources: [bucketArn],
      }),
    );
    role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'WriteSiteContent',
        actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
        resources: [`${bucketArn}/*`],
      }),
    );
    // The distribution doesn't exist yet when this stack is first deployed, so
    // this can't name it. Invalidation only clears caches.
    role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'InvalidateCloudFront',
        actions: ['cloudfront:CreateInvalidation', 'cloudfront:GetInvalidation'],
        resources: [`arn:aws:cloudfront::${this.account}:distribution/*`],
      }),
    );
    role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'ReadDeployParameters',
        actions: ['ssm:GetParameter', 'ssm:GetParameters'],
        resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter${names.ssmPrefix}/*`],
      }),
    );
    // Lets the workflow print stack outputs (site URL) in its summary.
    role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'DescribeOwnStacks',
        actions: ['cloudformation:DescribeStacks'],
        resources: [
          `arn:aws:cloudformation:${this.region}:${this.account}:stack/${names.stackPrefix}-*/*`,
        ],
      }),
    );

    new cdk.CfnOutput(this, `${label}DeployRoleArn`, {
      value: role.roleArn,
      description: `Set as the AWS_DEPLOY_ROLE_ARN variable on the "${envName}" GitHub Environment`,
    });
    return role;
  }
}

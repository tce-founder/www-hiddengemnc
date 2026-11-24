import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { PROJECT_BOOTSTRAP } from './config';

/**
 * The two managed policies behind this project's own CDK bootstrap
 * (`PROJECT_BOOTSTRAP`):
 *
 * - The execution policy, given to the bootstrap's CloudFormation execution
 *   role in place of AdministratorAccess. It reaches this project's resources
 *   by name (`hiddengem-*` and the `HiddenGem-*` names CloudFormation
 *   generates from the stack names), and may create a role only when the role
 *   carries the workload boundary.
 * - The workload boundary, the most any role the environment stacks create
 *   can do, whatever policy is attached to it.
 *
 * Both live in the hand-deployed OIDC stack, because `cdk bootstrap` must name
 * the execution policy, and because the execution role must never be able to
 * change them, the deploy roles, or the OIDC provider.
 */
export class BootstrapPolicies extends Construct {
  readonly executionPolicy: iam.ManagedPolicy;
  readonly boundary: iam.ManagedPolicy;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    const { account, region } = cdk.Stack.of(this);
    const arn = (service: string, resource: string, r = region) =>
      `arn:aws:${service}:${r}:${account}:${resource}`;
    const named = (service: string, prefix: string, r = region) => [
      arn(service, `${prefix}hiddengem-*`, r),
      arn(service, `${prefix}HiddenGem-*`, r),
    ];

    const boundaryArn = `arn:aws:iam::${account}:policy/${PROJECT_BOOTSTRAP.boundaryName}`;
    // A trailing * also matches `/` and `:`, so each pattern covers objects,
    // indexes and log streams too.
    const buckets = ['arn:aws:s3:::hiddengem-*'];
    const tables = [arn('dynamodb', 'table/hiddengem-*')];
    const secrets = arn('secretsmanager', 'secret:hiddengem/*');
    const parameters = arn('ssm', 'parameter/hiddengem/*');
    const logGroups = [
      arn('logs', 'log-group:/aws/lambda/hiddengem-*'),
      arn('logs', 'log-group:/aws/lambda/HiddenGem-*'),
      arn('logs', 'log-group:HiddenGem-*'),
    ];
    const projectRoles = [
      `arn:aws:iam::${account}:role/HiddenGem-*`,
      `arn:aws:iam::${account}:role/hiddengem-*`,
    ];
    const zoneNames = ['hiddengemnc.com', '*.hiddengemnc.com'];
    const mailIdentities = [
      arn('ses', 'identity/hiddengemnc.com'),
      arn('ses', 'identity/*.hiddengemnc.com'),
    ];
    // Resources with no name to scope by may be changed only while they carry this project's tag.
    const notOurs = { StringNotEquals: { 'aws:ResourceTag/Project': 'HiddenGem' } };

    this.boundary = new iam.ManagedPolicy(this, 'WorkloadBoundary', {
      managedPolicyName: PROJECT_BOOTSTRAP.boundaryName,
      description: 'hiddengemnc.com - the most a role created by the environment stacks may do',
      statements: [
        new iam.PolicyStatement({
          sid: 'Logs',
          actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
          resources: logGroups,
        }),
        new iam.PolicyStatement({
          sid: 'Submissions',
          actions: [
            'dynamodb:PutItem',
            'dynamodb:GetItem',
            'dynamodb:UpdateItem',
            'dynamodb:Query',
          ],
          resources: tables,
        }),
        new iam.PolicyStatement({
          sid: 'SendMail',
          actions: ['ses:SendEmail', 'ses:SendRawEmail'],
          resources: [...mailIdentities, arn('ses', 'configuration-set/hiddengem-*')],
        }),
        new iam.PolicyStatement({
          sid: 'ReadOwnConfig',
          actions: ['secretsmanager:GetSecretValue', 'ssm:GetParameter', 'ssm:GetParameters'],
          resources: [secrets, parameters],
        }),
        // The S3 auto-delete custom resource empties this project's buckets on teardown.
        new iam.PolicyStatement({
          sid: 'OwnBuckets',
          actions: [
            's3:GetBucketTagging',
            's3:ListBucket',
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject',
            's3:GetBucketPolicy',
            's3:PutBucketPolicy',
            's3:DeleteBucketPolicy',
          ],
          resources: buckets,
        }),
        new iam.PolicyStatement({
          sid: 'Tracing',
          actions: ['xray:PutTraceSegments', 'xray:PutTelemetryRecords'],
          resources: ['*'],
        }),
      ],
    });

    this.executionPolicy = new iam.ManagedPolicy(this, 'ExecutionPolicy', {
      managedPolicyName: PROJECT_BOOTSTRAP.executionPolicyName,
      description:
        "hiddengemnc.com - what this project's CDK CloudFormation execution role may do (no IAM beyond bounded project roles)",
      statements: [
        new iam.PolicyStatement({ sid: 'Buckets', actions: ['s3:*'], resources: buckets }),
        new iam.PolicyStatement({
          sid: 'ReadOwnAssets',
          actions: ['s3:GetObject', 's3:GetObjectVersion'],
          resources: [`arn:aws:s3:::cdk-${PROJECT_BOOTSTRAP.qualifier}-assets-${account}-*/*`],
        }),
        new iam.PolicyStatement({
          sid: 'Functions',
          actions: ['lambda:*'],
          resources: named('lambda', 'function:'),
        }),
        new iam.PolicyStatement({ sid: 'Tables', actions: ['dynamodb:*'], resources: tables }),
        new iam.PolicyStatement({
          sid: 'TableLimits',
          actions: ['dynamodb:DescribeLimits', 'dynamodb:ListTables'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'Secrets',
          actions: ['secretsmanager:*'],
          resources: [secrets],
        }),
        new iam.PolicyStatement({
          sid: 'RandomPasswords',
          actions: ['secretsmanager:GetRandomPassword'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'Parameters',
          actions: [
            'ssm:PutParameter',
            'ssm:DeleteParameter',
            'ssm:GetParameter',
            'ssm:GetParameters',
            'ssm:AddTagsToResource',
            'ssm:RemoveTagsFromResource',
            'ssm:ListTagsForResource',
          ],
          resources: [parameters],
        }),
        // The templates' BootstrapVersion rule reads this through the execution role.
        new iam.PolicyStatement({
          sid: 'BootstrapVersion',
          actions: ['ssm:GetParameter', 'ssm:GetParameters'],
          resources: [arn('ssm', `parameter/cdk-bootstrap/${PROJECT_BOOTSTRAP.qualifier}/version`)],
        }),
        new iam.PolicyStatement({
          sid: 'LogGroups',
          actions: ['logs:*'],
          resources: logGroups,
        }),
        new iam.PolicyStatement({
          sid: 'DescribeLogGroups',
          actions: ['logs:DescribeLogGroups'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'Api',
          actions: [
            'apigateway:GET',
            'apigateway:POST',
            'apigateway:PUT',
            'apigateway:PATCH',
            'apigateway:DELETE',
          ],
          resources: [`arn:aws:apigateway:${region}::/*`],
        }),
        new iam.PolicyStatement({
          sid: 'OtherProjectsApis',
          effect: iam.Effect.DENY,
          actions: ['apigateway:POST', 'apigateway:PUT', 'apigateway:PATCH', 'apigateway:DELETE'],
          resources: [
            `arn:aws:apigateway:${region}::/restapis/*`,
            `arn:aws:apigateway:${region}::/tags/*`,
          ],
          conditions: notOurs,
        }),
        new iam.PolicyStatement({
          sid: 'NotTheApiAccount',
          effect: iam.Effect.DENY,
          actions: ['apigateway:PATCH', 'apigateway:PUT', 'apigateway:POST', 'apigateway:DELETE'],
          resources: [
            `arn:aws:apigateway:${region}::/account`,
            `arn:aws:apigateway:${region}::/domainnames*`,
          ],
        }),
        // CloudFront has no names to scope by; an existing distribution must carry this project's tag.
        new iam.PolicyStatement({ sid: 'Cdn', actions: ['cloudfront:*'], resources: ['*'] }),
        new iam.PolicyStatement({
          sid: 'OtherProjectsDistributions',
          effect: iam.Effect.DENY,
          actions: [
            'cloudfront:UpdateDistribution',
            'cloudfront:DeleteDistribution',
            'cloudfront:AssociateAlias',
            'cloudfront:CreateInvalidation',
            'cloudfront:TagResource',
            'cloudfront:UntagResource',
          ],
          resources: [`arn:aws:cloudfront::${account}:distribution/*`],
          conditions: notOurs,
        }),
        new iam.PolicyStatement({
          sid: 'OtherProjectsFunctions',
          effect: iam.Effect.DENY,
          actions: [
            'cloudfront:UpdateFunction',
            'cloudfront:PublishFunction',
            'cloudfront:DeleteFunction',
          ],
          notResources: [`arn:aws:cloudfront::${account}:function/hiddengem-*`],
        }),
        new iam.PolicyStatement({
          sid: 'Certificates',
          actions: [
            'acm:RequestCertificate',
            'acm:DescribeCertificate',
            'acm:DeleteCertificate',
            'acm:AddTagsToCertificate',
            'acm:RemoveTagsFromCertificate',
            'acm:ListTagsForCertificate',
          ],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'OtherProjectsCertificates',
          effect: iam.Effect.DENY,
          actions: [
            'acm:DeleteCertificate',
            'acm:AddTagsToCertificate',
            'acm:RemoveTagsFromCertificate',
          ],
          resources: [arn('acm', 'certificate/*', 'us-east-1'), arn('acm', 'certificate/*')],
          conditions: notOurs,
        }),
        new iam.PolicyStatement({
          sid: 'Zones',
          actions: [
            'route53:CreateHostedZone',
            'route53:GetHostedZone',
            'route53:ListHostedZones',
            'route53:ListHostedZonesByName',
            'route53:ListResourceRecordSets',
            'route53:GetChange',
            'route53:ChangeTagsForResource',
            'route53:ListTagsForResource',
          ],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'OwnRecordsOnly',
          actions: ['route53:ChangeResourceRecordSets'],
          resources: ['arn:aws:route53:::hostedzone/*'],
          conditions: {
            'ForAllValues:StringLike': {
              'route53:ChangeResourceRecordSetsNormalizedRecordNames': zoneNames,
            },
          },
        }),
        new iam.PolicyStatement({
          sid: 'Mail',
          actions: ['ses:*'],
          resources: [...mailIdentities, arn('ses', 'configuration-set/hiddengem-*')],
        }),
        new iam.PolicyStatement({
          sid: 'Firewall',
          actions: ['wafv2:*'],
          resources: [
            arn('wafv2', 'global/webacl/hiddengem-*/*', 'us-east-1'),
            arn('wafv2', 'global/managedruleset/*/*', 'us-east-1'),
          ],
        }),
        new iam.PolicyStatement({
          sid: 'CreateBoundedRoles',
          actions: [
            'iam:CreateRole',
            'iam:PutRolePolicy',
            'iam:DeleteRolePolicy',
            'iam:AttachRolePolicy',
            'iam:DetachRolePolicy',
            'iam:PutRolePermissionsBoundary',
          ],
          resources: projectRoles,
          conditions: { StringEquals: { 'iam:PermissionsBoundary': boundaryArn } },
        }),
        new iam.PolicyStatement({
          sid: 'ManageProjectRoles',
          actions: [
            'iam:GetRole',
            'iam:GetRolePolicy',
            'iam:ListRolePolicies',
            'iam:ListAttachedRolePolicies',
            'iam:ListRoleTags',
            'iam:TagRole',
            'iam:UntagRole',
            'iam:UpdateRole',
            'iam:UpdateRoleDescription',
            'iam:DeleteRole',
          ],
          resources: projectRoles,
        }),
        // Roles here are only ever handed to Lambda. Changing a role's trust is
        // not allowed at all: replace the role instead.
        new iam.PolicyStatement({
          sid: 'PassProjectRolesToLambda',
          actions: ['iam:PassRole'],
          resources: projectRoles,
          conditions: { StringEquals: { 'iam:PassedToService': 'lambda.amazonaws.com' } },
        }),
        // Never the deploy roles, the OIDC provider, these policies, or a boundary removal.
        new iam.PolicyStatement({
          sid: 'NotTheDeployPath',
          effect: iam.Effect.DENY,
          notActions: [
            'iam:GetRole',
            'iam:GetPolicy',
            'iam:GetPolicyVersion',
            'iam:ListRoleTags',
            'iam:ListRolePolicies',
            'iam:ListAttachedRolePolicies',
          ],
          resources: [
            `arn:aws:iam::${account}:role/hiddengem-*-github-deploy`,
            `arn:aws:iam::${account}:policy/${PROJECT_BOOTSTRAP.boundaryName}`,
            `arn:aws:iam::${account}:policy/${PROJECT_BOOTSTRAP.executionPolicyName}`,
            `arn:aws:iam::${account}:oidc-provider/*`,
          ],
        }),
        new iam.PolicyStatement({
          sid: 'KeepTheBoundary',
          effect: iam.Effect.DENY,
          actions: ['iam:DeleteRolePermissionsBoundary'],
          resources: ['*'],
        }),
      ],
    });
  }
}

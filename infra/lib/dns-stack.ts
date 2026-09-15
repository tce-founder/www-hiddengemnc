import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import type { Construct } from 'constructs';
import type { EnvName } from './config';

interface DnsStackProps extends cdk.StackProps {
  envName: EnvName;
  /** e.g. d.hiddengemnc.com (dev) or mail.hiddengemnc.com (prod). */
  zoneName: string;
  apexDomain: string;
  /** The existing hiddengemnc.com zone, in this same account. */
  apexZoneId: string;
}

/**
 * This environment's own hosted zone, delegated from the existing
 * hiddengemnc.com zone by an NS record this stack writes there.
 *
 * The subzone holds the environment's SES records (Identity.publicHostedZone
 * needs a zone named after the sending domain) and, for dev, the site's
 * certificate-validation and alias records. In the apex zone CDK writes only
 * names it owns: these delegations, plus prod's site records (Frontend stack).
 * It never creates or replaces the apex zone itself.
 */
export class DnsStack extends cdk.Stack {
  readonly hostedZone: route53.PublicHostedZone;
  /** The existing apex zone, imported by id. */
  readonly apexZone: route53.IHostedZone;

  constructor(scope: Construct, id: string, props: DnsStackProps) {
    super(scope, id, props);

    this.apexZone = route53.HostedZone.fromHostedZoneAttributes(this, 'ApexZone', {
      hostedZoneId: props.apexZoneId,
      zoneName: props.apexDomain,
    });

    this.hostedZone = new route53.PublicHostedZone(this, 'Zone', {
      zoneName: props.zoneName,
      comment: `hiddengemnc.com ${props.envName} — delegated from ${props.apexDomain}`,
      // Only Amazon may issue certificates for names in this zone.
      caaAmazon: true,
    });
    // Keep the zone (and the records other stacks wrote to it) if this stack is deleted.
    this.hostedZone.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    new route53.ZoneDelegationRecord(this, 'Delegation', {
      zone: this.apexZone,
      recordName: props.zoneName,
      nameServers: this.hostedZone.hostedZoneNameServers!,
      ttl: cdk.Duration.days(1),
    });

    new cdk.CfnOutput(this, 'HostedZoneId', { value: this.hostedZone.hostedZoneId });
    new cdk.CfnOutput(this, 'NameServers', {
      value: cdk.Fn.join(',', this.hostedZone.hostedZoneNameServers!),
      description: `Name servers for ${props.zoneName}, delegated from ${props.apexDomain}`,
    });
  }
}

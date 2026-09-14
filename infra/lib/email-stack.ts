import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as ses from 'aws-cdk-lib/aws-ses';
import type { Construct } from 'constructs';
import type { EnvName } from './config';

interface EmailStackProps extends cdk.StackProps {
  envName: EnvName;
  /** The environment's own zone; its name is the sending domain. */
  hostedZone: route53.IHostedZone;
}

/**
 * SES sending identity for the contact API: the environment's zone domain
 * (d.hiddengemnc.com or mail.hiddengemnc.com), verified with Easy DKIM, a
 * custom MAIL FROM (bounce.<domain>) for SPF alignment, and a DMARC policy.
 * CDK writes every record into the zone, so verification completes without
 * manual DNS work. A subdomain keeps this clear of any mail set up on
 * hiddengemnc.com itself.
 *
 * The account has SES production access (checked 14 September 2026), so mail
 * reaches any address and recipients need no verification. That is also why
 * dev turns off the acknowledgement to submitters (sendConfirmationEmail in
 * cdk.json). The account's other SES identities belong to other projects; this
 * stack creates only its own domain.
 */
export class EmailStack extends cdk.Stack {
  readonly configurationSet: ses.ConfigurationSet;

  constructor(scope: Construct, id: string, props: EmailStackProps) {
    super(scope, id, props);
    const { envName, hostedZone } = props;
    const domain = hostedZone.zoneName;

    this.configurationSet = new ses.ConfigurationSet(this, 'ConfigurationSet', {
      configurationSetName: `hiddengem-${envName}`,
      reputationMetrics: true,
      suppressionReasons: ses.SuppressionReasons.BOUNCES_AND_COMPLAINTS,
    });

    new ses.EmailIdentity(this, 'DomainIdentity', {
      identity: ses.Identity.publicHostedZone(hostedZone),
      mailFromDomain: `bounce.${domain}`,
      configurationSet: this.configurationSet,
    });

    new route53.TxtRecord(this, 'Dmarc', {
      zone: hostedZone,
      recordName: `_dmarc.${domain}`,
      values: ['v=DMARC1; p=quarantine; adkim=s; aspf=r'],
      ttl: cdk.Duration.hours(1),
    });

    new cdk.CfnOutput(this, 'SendingDomain', { value: domain });
  }
}

#!/usr/bin/env bash
# Setup so GitHub Actions can deploy, and the only way the deploy path changes:
#   1. HiddenGem-Shared-GithubOidc: the account's GitHub OIDC provider, the dev +
#      prod deploy roles, and this project's CDK execution policy and boundary.
#   2. CDKToolkit-hiddengem: this project's own CDK bootstrap (qualifier hgem),
#      whose CloudFormation execution role holds that execution policy instead
#      of AdministratorAccess.
#
# Dev and prod share one AWS account. Its default CDKToolkit belongs to other
# projects too; this script checks its version (step 1 deploys through it) and
# never changes it. Everything else (hosted zones, email, API, site) is
# deployed by the pipeline, through CDKToolkit-hiddengem. Re-run this after any
# change to infra/lib/github-oidc-stack.ts or infra/lib/bootstrap-policies.ts.
#
# CDK asks you to confirm the IAM changes before deploying; pass --yes to skip
# that prompt (e.g. no terminal).
#
# Usage: scripts/bootstrap/bootstrap-account.sh [--yes]

# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

REQUIRE_APPROVAL=broadening
for arg in "$@"; do
  if [ "$arg" = --yes ]; then REQUIRE_APPROVAL=never; fi
done

require_profile

# CDK's default synthesizer needs bootstrap version 6 or later.
BOOTSTRAP_VERSION=$(aws ssm get-parameter --profile "$PROFILE" --region "$REGION" \
  --name /cdk-bootstrap/hnb659fds/version --query Parameter.Value --output text 2>/dev/null || true)
if ! [[ "$BOOTSTRAP_VERSION" =~ ^[0-9]+$ ]] || [ "$BOOTSTRAP_VERSION" -lt 6 ]; then
  echo "Account $ACCOUNT needs CDK bootstrap version 6 or later in $REGION (found: ${BOOTSTRAP_VERSION:-none})." >&2
  echo "Other projects share that bootstrap, so this script won't change it; run 'cdk bootstrap' deliberately." >&2
  exit 1
fi
echo "==> CDK bootstrap version $BOOTSTRAP_VERSION found in $ACCOUNT (left as it is)"

echo "==> Building the API (the CDK app bundles it)"
(cd "$REPO_ROOT" && pnpm nx build api --outputStyle=static)

cd "$REPO_ROOT/infra" || exit 1

echo "==> Deploying $SHARED_OIDC_STACK (profile $PROFILE)"
pnpm exec cdk deploy "$SHARED_OIDC_STACK" \
  --profile "$PROFILE" --context env=prod --exclusively \
  --require-approval "$REQUIRE_APPROVAL"

echo "==> Bootstrapping $BOOTSTRAP_STACK (qualifier $BOOTSTRAP_QUALIFIER, execution policy $EXECUTION_POLICY)"
pnpm exec cdk bootstrap "aws://$ACCOUNT/$REGION" \
  --profile "$PROFILE" \
  --qualifier "$BOOTSTRAP_QUALIFIER" \
  --toolkit-stack-name "$BOOTSTRAP_STACK" \
  --cloudformation-execution-policies "arn:aws:iam::$ACCOUNT:policy/$EXECUTION_POLICY" \
  --require-approval "$REQUIRE_APPROVAL"

DEV_ROLE=$(stack_output "$SHARED_OIDC_STACK" DevDeployRoleArn)
PROD_ROLE=$(stack_output "$SHARED_OIDC_STACK" ProdDeployRoleArn)

cat <<EOF

Done — GitHub Actions can now deploy to account $ACCOUNT.

  dev deploy role   $DEV_ROLE
  prod deploy role  $PROD_ROLE

Next:
  scripts/bootstrap/configure-github.sh            # preview the GitHub setup
  scripts/bootstrap/configure-github.sh --apply    # apply it
EOF

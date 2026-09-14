#!/usr/bin/env bash
# One-time setup so GitHub Actions can deploy: the HiddenGem-Shared-GithubOidc
# stack (the account's GitHub OIDC provider and the dev + prod deploy roles).
#
# Dev and prod share one AWS account. It is already CDK-bootstrapped (the
# default CDKToolkit stack, which other projects use too); this script checks
# the version and never changes it. Everything else (hosted zones, email, API,
# site) is deployed by the pipeline.
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

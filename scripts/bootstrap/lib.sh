# shellcheck shell=bash
# Shared helpers for scripts/bootstrap/*. Sourced, not run.
#
# Every value comes from infra/cdk.json so the scripts and the CDK app can't
# disagree about the account, names or repository.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CDK_JSON="$REPO_ROOT/infra/cdk.json"

for tool in aws jq; do
  command -v "$tool" >/dev/null || { echo "Missing required tool: $tool" >&2; exit 1; }
done

# cfg '.github.repo'  → value from the hiddengem context block
cfg() { jq -r ".context.hiddengem$1" "$CDK_JSON"; }

# Dev and prod share one AWS account (infra/lib/config.ts checks this), so the
# account, region and profile come from the dev entry.
# shellcheck disable=SC2034 # read by the scripts that source this file
{
  ACCOUNT=$(cfg .environments.dev.account)
  REGION=$(cfg .environments.dev.region)
  PROFILE=$(cfg .environments.dev.profile)
  SHARED_OIDC_STACK=HiddenGem-Shared-GithubOidc # SHARED_OIDC_STACK in infra/lib/config.ts
}

# Fail unless the AWS profile is signed in to the expected account.
require_profile() {
  local actual
  actual=$(aws sts get-caller-identity --profile "$PROFILE" --query Account --output text 2>/dev/null) || {
    echo "Not signed in to AWS profile '$PROFILE' — run: aws sso login --profile $PROFILE" >&2
    exit 1
  }
  if [ "$actual" != "$ACCOUNT" ]; then
    echo "Profile '$PROFILE' is account $actual; expected $ACCOUNT. Refusing to continue." >&2
    exit 1
  fi
}

# stack_output <stack> <output key>
stack_output() {
  aws cloudformation describe-stacks --profile "$PROFILE" --region "$REGION" --stack-name "$1" \
    --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue | [0]" --output text 2>/dev/null || true
}

# Scripts that change shared state only do so with --apply.
# shellcheck disable=SC2034 # APPLY is read by the scripts that source this file
{
  APPLY=false
  for arg in "$@"; do
    if [ "$arg" = --apply ]; then APPLY=true; fi
  done
}

dry_run_notice() {
  echo
  echo "Dry run — nothing was changed. Re-run with --apply to make the change above."
}

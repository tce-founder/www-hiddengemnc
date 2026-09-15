#!/usr/bin/env bash
# Configures the GitHub side of the pipeline:
#
#   - a `develop` branch (from main) if there isn't one
#   - GitHub Environments `dev` (deployable from develop) and `prod` (from main only)
#   - AWS_DEPLOY_ROLE_ARN on each Environment, read from the shared GithubOidc stack
#   - branch protection: PRs + passing CI on develop and main; main also needs
#     approvals (1 by default; --main-approvals=0 suits a single maintainer)
#
# Secrets are never passed as arguments; set them afterwards (the script prints how).
# For a repository owned by a personal account, Environment branch rules and
# branch protection need the repo to be public or the owner to have GitHub Pro.
#
# Usage: scripts/bootstrap/configure-github.sh [--main-approvals=N] [--apply]

# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"
command -v gh >/dev/null || { echo "Missing required tool: gh" >&2; exit 1; }

REPO="$(cfg .github.owner)/$(cfg .github.repo)"
CI_CHECK='Lint, typecheck, test, build, synth' # job name in .github/workflows/ci.yml
MAIN_APPROVALS=1
for arg in "$@"; do
  case "$arg" in
    --main-approvals=*) MAIN_APPROVALS=${arg#*=} ;;
  esac
done

run() {
  echo "+ $*"
  if [ "$APPLY" = true ]; then "$@"; fi
}

echo "Repository: $REPO"

# develop branch
if gh api "repos/$REPO/branches/develop" >/dev/null 2>&1; then
  echo "develop branch exists"
else
  MAIN_SHA=$(gh api "repos/$REPO/git/ref/heads/main" --jq .object.sha)
  run gh api "repos/$REPO/git/refs" -f ref=refs/heads/develop -f sha="$MAIN_SHA" --silent
fi

# Environments, each deployable from one branch only
for entry in dev:develop:DevDeployRoleArn prod:main:ProdDeployRoleArn; do
  IFS=: read -r ENV_NAME BRANCH ROLE_OUTPUT <<<"$entry"
  run gh api -X PUT "repos/$REPO/environments/$ENV_NAME" --silent \
    -F 'deployment_branch_policy[protected_branches]=false' \
    -F 'deployment_branch_policy[custom_branch_policies]=true'
  if ! gh api "repos/$REPO/environments/$ENV_NAME/deployment-branch-policies" \
    --jq '.branch_policies[].name' 2>/dev/null | grep -qx "$BRANCH"; then
    run gh api -X POST "repos/$REPO/environments/$ENV_NAME/deployment-branch-policies" \
      -f name="$BRANCH" -f type=branch --silent
  fi

  ROLE_ARN=$(stack_output "$SHARED_OIDC_STACK" "$ROLE_OUTPUT")
  if [ -n "$ROLE_ARN" ] && [ "$ROLE_ARN" != None ]; then
    run gh variable set AWS_DEPLOY_ROLE_ARN --repo "$REPO" --env "$ENV_NAME" --body "$ROLE_ARN"
  else
    echo "!! No $ENV_NAME deploy role found (profile $PROFILE) — run bootstrap-account.sh, then re-run this."
  fi
done

# Branch protection
protect() {
  local branch=$1 approvals=$2
  jq -n --arg check "$CI_CHECK" --argjson approvals "$approvals" '{
    required_status_checks: { strict: true, contexts: [$check] },
    enforce_admins: false,
    required_pull_request_reviews: { required_approving_review_count: $approvals },
    restrictions: null,
    allow_force_pushes: false,
    allow_deletions: false
  }' >"${TMPDIR:-/tmp}/protection-$branch.json"
  run gh api -X PUT "repos/$REPO/branches/$branch/protection" --silent \
    --input "${TMPDIR:-/tmp}/protection-$branch.json"
}
protect develop 0
protect main "$MAIN_APPROVALS"

if [ "$APPLY" != true ]; then
  dry_run_notice
fi

cat <<EOF

Then set the secrets (you'll be prompted for each value):
  gh secret set BASIC_AUTH_PASSWORD  --repo $REPO --env dev     # dev preview password
  gh secret set RECAPTCHA_SECRET_KEY --repo $REPO --env dev
  gh secret set RECAPTCHA_SECRET_KEY --repo $REPO --env prod
and the public values (they end up in the browser anyway):
  gh variable set RECAPTCHA_SITE_KEY --repo $REPO --env dev  --body <site key>
  gh variable set RECAPTCHA_SITE_KEY --repo $REPO --env prod --body <site key>
  gh variable set GA_MEASUREMENT_ID  --repo $REPO --env dev  --body <G-…>
  gh variable set GA_MEASUREMENT_ID  --repo $REPO --env prod --body <G-…>
EOF

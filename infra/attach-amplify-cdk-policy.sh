#!/usr/bin/env bash
# Attach CDK deploy permissions to the Amplify Gen 2 CodeBuild role.
#
# Run with credentials for the Amplify hosting account (450545962167):
#   AWS_PROFILE=amplify-deploy ./infra/attach-amplify-cdk-policy.sh
#
# Optional overrides:
#   AMPLIFY_ACCOUNT=450545962167
#   AMPLIFY_REGION=us-west-2
#   CODEBUILD_ROLE_NAME=AmplifySSRLoggingRole-05388f2e-7e5b-4c0e-9107-f989aac9a81f
#   POLICY_NAME=CrewLinkAmplifyCdkDeploy

set -eo pipefail

AMPLIFY_ACCOUNT="${AMPLIFY_ACCOUNT:-450545962167}"
AMPLIFY_REGION="${AMPLIFY_REGION:-us-west-2}"
CODEBUILD_ROLE_NAME="${CODEBUILD_ROLE_NAME:-AmplifySSRLoggingRole-05388f2e-7e5b-4c0e-9107-f989aac9a81f}"
POLICY_NAME="${POLICY_NAME:-CrewLinkAmplifyCdkDeploy}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POLICY_FILE="${SCRIPT_DIR}/amplify-cdk-build-policy.json"

echo "Account:  ${AMPLIFY_ACCOUNT}"
echo "Region:   ${AMPLIFY_REGION}"
echo "Role:     ${CODEBUILD_ROLE_NAME}"
echo "Policy:   ${POLICY_NAME}"
echo

CURRENT_ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
if [[ "${CURRENT_ACCOUNT}" != "${AMPLIFY_ACCOUNT}" ]]; then
  echo "ERROR: AWS credentials are for account ${CURRENT_ACCOUNT}, expected ${AMPLIFY_ACCOUNT}."
  echo "Set AWS_PROFILE or credentials for the Amplify hosting account and retry."
  exit 1
fi

echo "Checking CDK bootstrap SSM parameter..."
if ! aws ssm get-parameter \
  --region "${AMPLIFY_REGION}" \
  --name "/cdk-bootstrap/hnb659fds/version" >/dev/null 2>&1; then
  echo
  echo "CDK bootstrap is missing in ${AMPLIFY_ACCOUNT}/${AMPLIFY_REGION}."
  echo "Bootstrap once from this repo, then re-run this script:"
  echo "  npx cdk bootstrap aws://${AMPLIFY_ACCOUNT}/${AMPLIFY_REGION}"
  echo
fi

POLICY_ARN="arn:aws:iam::${AMPLIFY_ACCOUNT}:policy/${POLICY_NAME}"

if aws iam get-policy --policy-arn "${POLICY_ARN}" >/dev/null 2>&1; then
  echo "Updating existing managed policy ${POLICY_NAME}..."
  VERSIONS="$(aws iam list-policy-versions --policy-arn "${POLICY_ARN}" --query 'Versions[?IsDefaultVersion==`false`].VersionId' --output text)"
  for VERSION in ${VERSIONS}; do
    aws iam delete-policy-version --policy-arn "${POLICY_ARN}" --version-id "${VERSION}" || true
  done
  aws iam create-policy-version \
    --policy-arn "${POLICY_ARN}" \
    --policy-document "file://${POLICY_FILE}" \
    --set-as-default
else
  echo "Creating managed policy ${POLICY_NAME}..."
  aws iam create-policy \
    --policy-name "${POLICY_NAME}" \
    --policy-document "file://${POLICY_FILE}" \
    --description "Allow Amplify CodeBuild to run cdk deploy for CrewLinkPipelineStack"
fi

echo "Attaching policy to role ${CODEBUILD_ROLE_NAME}..."
aws iam attach-role-policy \
  --role-name "${CODEBUILD_ROLE_NAME}" \
  --policy-arn "${POLICY_ARN}"

echo
echo "Done. Re-run the Amplify backend build."
echo "If the role name changed, find it in IAM (Amplify app -> Backend -> Build role) and set CODEBUILD_ROLE_NAME."

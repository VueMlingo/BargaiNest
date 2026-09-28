#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# BN-046 — schedules the reward-expiry notification check.
#
# The check itself (POST /internal/notifications/run-reward-expiry-check)
# has existed and been tested since the Account Details section work --
# this pilot simply has no cron/scheduler infrastructure to actually call
# it. This script creates that missing piece: a Google Cloud Scheduler
# job that calls the endpoint once a day.
#
# Usage:
#   INTERNAL_TASK_SECRET=<your-secret> \
#   BACKEND_URL=https://your-backend-url \
#   GCP_PROJECT=your-gcp-project \
#   GCP_REGION=africa-south1 \
#   ./scripts/setup-reward-expiry-scheduler.sh
#
# Requires: gcloud CLI authenticated against the target project, and
# the Cloud Scheduler API enabled on that project (this script enables
# it if it isn't already).
# ---------------------------------------------------------------------------

: "${INTERNAL_TASK_SECRET:?Set INTERNAL_TASK_SECRET to the same value configured on the backend}"
: "${BACKEND_URL:?Set BACKEND_URL to your deployed backend base URL, e.g. https://bargainest-backend-xxxxx.a.run.app}"
: "${GCP_PROJECT:?Set GCP_PROJECT to your GCP project id}"
GCP_REGION="${GCP_REGION:-africa-south1}"
JOB_NAME="${JOB_NAME:-reward-expiry-check}"
SCHEDULE="${SCHEDULE:-0 6 * * *}" # daily at 06:00, in the job's configured timezone

echo "Enabling Cloud Scheduler API (no-op if already enabled)..."
gcloud services enable cloudscheduler.googleapis.com --project "$GCP_PROJECT"

echo "Creating/updating Cloud Scheduler job '$JOB_NAME'..."
if gcloud scheduler jobs describe "$JOB_NAME" --project "$GCP_PROJECT" --location "$GCP_REGION" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "$JOB_NAME" \
    --project "$GCP_PROJECT" \
    --location "$GCP_REGION" \
    --schedule "$SCHEDULE" \
    --uri "${BACKEND_URL%/}/internal/notifications/run-reward-expiry-check" \
    --http-method POST \
    --headers "x-internal-secret=${INTERNAL_TASK_SECRET}" \
    --time-zone "Africa/Johannesburg"
else
  gcloud scheduler jobs create http "$JOB_NAME" \
    --project "$GCP_PROJECT" \
    --location "$GCP_REGION" \
    --schedule "$SCHEDULE" \
    --uri "${BACKEND_URL%/}/internal/notifications/run-reward-expiry-check" \
    --http-method POST \
    --headers "x-internal-secret=${INTERNAL_TASK_SECRET}" \
    --time-zone "Africa/Johannesburg"
fi

echo ""
echo "Done. Verify with:"
echo "  gcloud scheduler jobs describe $JOB_NAME --project $GCP_PROJECT --location $GCP_REGION"
echo ""
echo "Trigger it manually right now to confirm it works end to end:"
echo "  gcloud scheduler jobs run $JOB_NAME --project $GCP_PROJECT --location $GCP_REGION"

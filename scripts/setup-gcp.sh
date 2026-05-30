#!/usr/bin/env bash
# One-time GCP setup for the AI build pipeline: APIs, the Cloud Tasks queue, the
# invoker service account, and the IAM that lets onRunCreated enqueue tasks that
# call the worker. Run-invoker on the worker and locking it down happen after the
# first deploy (the commands are printed at the end).
#
# Prereqs: gcloud authenticated, the project on the Blaze (billing) plan.
# Usage:   PROJECT=your-project REGION=us-central1 ./scripts/setup-gcp.sh
set -euo pipefail

PROJECT="${PROJECT:?Set PROJECT=your-gcp-project}"
REGION="${REGION:-us-central1}"
QUEUE="${QUEUE:-build-runs}"
INVOKER_NAME="${INVOKER_NAME:-tasks-invoker}"
FUNCTIONS_SA="${FUNCTIONS_SA:-${PROJECT}@appspot.gserviceaccount.com}"
WORKER_SERVICE="${WORKER_SERVICE:-runworker}"

INVOKER_SA="${INVOKER_NAME}@${PROJECT}.iam.gserviceaccount.com"

echo "Project: ${PROJECT}  Region: ${REGION}  Queue: ${QUEUE}"
gcloud config set project "${PROJECT}" >/dev/null
firebase use "${PROJECT}" >/dev/null 2>&1 || echo "    (set the Firebase project manually: firebase use ${PROJECT})"

echo "==> Enabling APIs"
gcloud services enable \
  cloudfunctions.googleapis.com run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com eventarc.googleapis.com pubsub.googleapis.com \
  cloudtasks.googleapis.com cloudscheduler.googleapis.com \
  firestore.googleapis.com secretmanager.googleapis.com iam.googleapis.com

echo "==> Cloud Tasks queue: ${QUEUE}"
gcloud tasks queues create "${QUEUE}" --location="${REGION}" || echo "    (already exists)"

echo "==> Invoker service account: ${INVOKER_SA}"
gcloud iam service-accounts create "${INVOKER_NAME}" \
  --display-name="Cloud Tasks -> worker invoker" || echo "    (already exists)"

echo "==> Functions SA (${FUNCTIONS_SA}): enqueue tasks + impersonate the invoker"
gcloud projects add-iam-policy-binding "${PROJECT}" \
  --member="serviceAccount:${FUNCTIONS_SA}" \
  --role="roles/cloudtasks.enqueuer" --condition=None >/dev/null
gcloud iam service-accounts add-iam-policy-binding "${INVOKER_SA}" \
  --member="serviceAccount:${FUNCTIONS_SA}" \
  --role="roles/iam.serviceAccountUser" --condition=None >/dev/null

cat <<EOF

Pre-deploy setup complete.

Put these (plus your repo details) in functions/.env:
  TASKS_LOCATION=${REGION}
  TASKS_QUEUE=${QUEUE}
  WORKER_URL=https://${REGION}-${PROJECT}.cloudfunctions.net/runWorker
  TASKS_INVOKER_SA=${INVOKER_SA}
  REPO_OWNER=<owner>
  REPO_NAME=<repo>
  WORK_BRANCH=<branch>

Set the secrets, then deploy:
  firebase functions:secrets:set ANTHROPIC_API_KEY
  firebase functions:secrets:set GITHUB_TOKEN        # needs push access
  firebase deploy --only firestore,functions

After the first deploy, restrict the worker to the invoker:
  gcloud run services add-iam-policy-binding ${WORKER_SERVICE} --region=${REGION} \\
    --member="serviceAccount:${INVOKER_SA}" --role="roles/run.invoker"
  gcloud run services remove-iam-policy-binding ${WORKER_SERVICE} --region=${REGION} \\
    --member="allUsers" --role="roles/run.invoker" 2>/dev/null || true
EOF

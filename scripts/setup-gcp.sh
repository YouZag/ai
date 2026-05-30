#!/usr/bin/env bash
# One-time GCP setup for the AI build pipeline. The worker is a Firebase task-queue
# function, so Firebase creates and wires its Cloud Tasks queue on deploy — this just
# enables the APIs and lets the functions service account enqueue tasks.
#
# Prereqs: gcloud + firebase authenticated, the project on the Blaze (billing) plan.
# Usage:   PROJECT=your-project ./scripts/setup-gcp.sh
set -euo pipefail

PROJECT="${PROJECT:?Set PROJECT=your-gcp-project}"
FUNCTIONS_SA="${FUNCTIONS_SA:-${PROJECT}@appspot.gserviceaccount.com}"

echo "Project: ${PROJECT}"
gcloud config set project "${PROJECT}" >/dev/null
firebase use "${PROJECT}" >/dev/null 2>&1 || echo "    (set the Firebase project manually: firebase use ${PROJECT})"

echo "==> Enabling APIs"
gcloud services enable \
  cloudfunctions.googleapis.com run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com eventarc.googleapis.com pubsub.googleapis.com \
  cloudtasks.googleapis.com cloudscheduler.googleapis.com \
  firestore.googleapis.com secretmanager.googleapis.com iam.googleapis.com

echo "==> Let the functions SA (${FUNCTIONS_SA}) enqueue tasks"
gcloud projects add-iam-policy-binding "${PROJECT}" \
  --member="serviceAccount:${FUNCTIONS_SA}" \
  --role="roles/cloudtasks.enqueuer" --condition=None >/dev/null

cat <<EOF

Setup complete. Firebase creates and wires the worker's task queue on deploy.

Next:
  firebase functions:secrets:set ANTHROPIC_API_KEY
  firebase functions:secrets:set GITHUB_TOKEN        # needs push access
  # functions/.env (copy from functions/.env.example): REPO_OWNER, REPO_NAME, WORK_BRANCH
  firebase deploy --only firestore,functions

If onRunCreated logs a Cloud Tasks permission error, your functions runtime SA may be
the compute SA instead of appspot. Re-run with
FUNCTIONS_SA=PROJECT_NUMBER-compute@developer.gserviceaccount.com.
EOF

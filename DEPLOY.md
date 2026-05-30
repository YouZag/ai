# Deploying

From this repo to a running instance. The architecture and per-piece detail live in
[docs/orchestration.md](docs/orchestration.md); this is the ordered runbook.

## Prerequisites

- A Firebase project on the **Blaze** plan (Gen2 functions + Cloud Tasks need billing).
- `gcloud` and `firebase` CLIs, authenticated (`gcloud auth login`, `firebase login`).
- A **GitHub token** with push access to the repo, and an **Anthropic API key**.
- Point both CLIs at your project: `gcloud config set project PROJECT` and
  `firebase use PROJECT` (step 2's script does this). The Firebase project comes from
  `.firebaserc`, not from `functions/.env`.

## 1. Client config

Fill the Firebase web config (Project settings → Your apps → SDK setup) into
`src/environments/environment.ts` and `environment.development.ts`, and set `admins`
to the Google accounts allowed into the cockpit. Enable **Google** under
Authentication → Sign-in method. The same admin emails must match `isAdmin()` in
`firestore.rules`.

## 2. Backend infrastructure

Enables APIs and creates the Cloud Tasks queue, the invoker service account, and its
IAM:

```bash
PROJECT=your-project REGION=us-central1 ./scripts/setup-gcp.sh
```

## 3. Secrets and params

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase functions:secrets:set GITHUB_TOKEN        # push access
```

Copy `functions/.env.example` to `functions/.env` and fill it in (the script prints
the exact values, plus your `REPO_OWNER`/`REPO_NAME`/`WORK_BRANCH`).

## 4. Deploy the backend

```bash
firebase deploy --only firestore,functions
```

Then restrict the worker to the invoker (the setup script printed these with your
values):

```bash
gcloud run services add-iam-policy-binding runworker --region=REGION \
  --member="serviceAccount:tasks-invoker@PROJECT.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
gcloud run services remove-iam-policy-binding runworker --region=REGION \
  --member="allUsers" --role="roles/run.invoker"
```

## 5. Deploy the cockpit (App Hosting)

The cockpit is an Angular SSR app. Deploy it with Firebase **App Hosting**, which
builds it on Cloud Build and serves the SSR app on Cloud Run:

```bash
firebase apphosting:backends:create --project your-project
```

Pick a region, connect this GitHub repo, and choose the branch to deploy from. App
Hosting then builds and rolls out on pushes to that branch; `apphosting.yaml` (repo
root) tunes the runtime. Use the working branch if you want the cockpit to redeploy
as the system improves itself, or a separate stable branch for manual control.

## 6. Light it up

Open the cockpit, sign in, and:

1. **Agents → Load defaults** — seeds the agent definitions.
2. **Vision** — write the north star → Save.
3. **Features** — add a feature → **Mark planned**.

The planning run is queued; watch **Pipeline** as the strategist turns it into steps
and the builder/tester/auditor agents take over. Tune any agent's prompt live in the
**Agents** view.

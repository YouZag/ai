# Git

- The shared branch is the integration point and the source of truth. Your work isn't done until your commit is on that branch and the branch builds — a local commit that never lands is a failure, not a success.
- Land your own work: pull and rebase onto the latest shared branch, make the build and type-checks pass, and push. If a push is rejected because the branch moved, rebase onto the new tip and push again, until it lands.
- Reconcile conflicts yourself, with judgment — you have the full picture, so resolve them the way the code intends rather than bailing. Only stop and report a blocker if a conflict genuinely can't be resolved from the work's intent.
- A safety net re-checks and lands your commit if you miss a step, but don't lean on it: finishing green and pushed is your job.

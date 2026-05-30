# Git

- The shared branch is the integration point, and git is the source of truth — recorded state trails it. A step is complete only once its commit is on the shared branch; work that never lands is a failure, not a success.
- Make the smallest change that satisfies the step, keep the build and type-checks green, and commit your work locally with a clear message. Do not push — the system rebases your commit onto the latest shared branch, re-verifies the build, and lands it for you.
- Because integration is automatic, you only need your commit to build cleanly on its own; if the shared branch has moved, it will be reconciled for you, and only a genuine conflict is handed back.

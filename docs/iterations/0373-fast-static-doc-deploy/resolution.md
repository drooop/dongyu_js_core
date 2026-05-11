---
id: 0373
title: fast-static-doc-deploy
doc_type: iteration_resolution
status: Completed
updated: 2026-05-12
source: ai
branch: dropx/0373-fast-static-doc-deploy
iteration_id: 0373-fast-static-doc-deploy
phase: phase3
---

# Iteration 0373 Fast Static Doc Deploy Resolution

## Execution Strategy

- Treat this as a docs/static-only remote publish. Avoid the normal image build path because this change does not affect runtime code. Preserve revision traceability by syncing the remote repo first, then copy only the public docs/static files into the UI Server persisted volume.

## Step 1 - Fast Path Contract

- Scope: Add and document a docs/static-only remote deploy path.
- Files:
  - `scripts/ops/deploy_cloud_public_docs_fast.sh`
  - `scripts/ops/README.md`
  - `docs/deployment/cloud_public_docs_fast_deploy.md`
  - `docs/README.md`
  - `scripts/tests/test_0373_cloud_public_docs_fast_deploy_contract.mjs`
  - `scripts/tests/test_0353_slide_app_runtime_docs_publish_contract.mjs`
- Verification:
  - `node scripts/tests/test_0373_cloud_public_docs_fast_deploy_contract.mjs`
  - `node scripts/tests/test_0353_slide_app_runtime_docs_publish_contract.mjs`
- Acceptance: Tests confirm the fast path syncs public docs/static HTML and does not contain build/restart operations.
- Rollback: Revert this branch before merge.

## Step 2 - Merge And Push

- Scope: Commit branch, merge to `dev`, merge `dev` to `main`, push both branches.
- Files:
  - Git history only.
- Verification:
  - `git status --short --branch`
  - `git rev-parse --short dev origin/dev main origin/main`
- Acceptance: `dev == origin/dev` and `main == origin/main` after push.
- Rollback: Revert merge commits if needed.

## Step 3 - Remote Fast Deploy And Public Verification

- Scope: Publish updated docs/static HTML to remote UI Server persisted statics.
- Files:
  - Remote `/home/wwpic/dongyu/volume/persist/ui-server/docs/user-guide/slide-app-runtime/*`
  - Remote `/home/wwpic/dongyu/volume/persist/ui-server/static_projects/slide-app-runtime-minimal-submit-provider/*`
- Verification:
  - `bash scripts/ops/deploy_cloud_public_docs_fast.sh ...`
  - `curl -I https://app.dongyudigital.com/p/slide-app-runtime-minimal-submit-provider/`
  - `curl -I https://app.dongyudigital.com/p/slide-app-runtime-minimal-submit-provider/minimal_submit_app_provider_interactive.html`
  - Playwright open/click remote "提交按钮" panel.
- Acceptance: Remote URL returns 200 and Playwright sees the updated panel.
- Rollback: Re-run the same script with the previous `main` revision.

## Notes

- Generated at: 2026-05-12

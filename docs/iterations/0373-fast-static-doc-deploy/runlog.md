---
id: 0373
title: fast-static-doc-deploy
doc_type: iteration_runlog
status: Completed
updated: 2026-05-12
source: ai
branch: dropx/0373-fast-static-doc-deploy
iteration_id: 0373-fast-static-doc-deploy
phase: phase4
---

# Iteration 0373 Fast Static Doc Deploy Runlog

## Environment

- Date: 2026-05-12
- Branch: `dropx/0373-fast-static-doc-deploy`
- Runtime: docs/static-only cloud publish; no image rebuild planned

Review Gate Record
- Iteration ID: 0373-fast-static-doc-deploy
- Review Date: 2026-05-12
- Review Type: User request
- Review Index: 1/1
- Decision: Approved
- Notes: User requested commit/merge/push and remote deployment with optimized recorded process.

## Execution Records

### Step 1 - Fast Path Contract

- Command: `rg --files docs scripts k8s | rg "deploy|cloud|static|statics|slide-app|runbook|ops"`
- Key output: confirmed existing public docs sync script `scripts/ops/sync_ui_public_docs.sh` and current remote build deploy scripts.
- Change: Added `scripts/ops/deploy_cloud_public_docs_fast.sh`.
- Change: Added `docs/deployment/cloud_public_docs_fast_deploy.md` and updated `scripts/ops/README.md`.
- Change: Added deterministic fast-path contract test.
- Command: `node scripts/tests/test_0373_cloud_public_docs_fast_deploy_contract.mjs`
- Key output: `2 passed, 0 failed out of 2`.
- Command: `node scripts/tests/test_0353_slide_app_runtime_docs_publish_contract.mjs`
- Key output: `5 passed, 0 failed out of 5`.
- Command: `node scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs`
- Key output: `7 passed, 0 failed out of 7`.
- Command: `node scripts/tests/test_0349_remote_deploy_sync_contract.mjs`
- Key output: `PASS test_0349_remote_deploy_sync_contract`.
- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS
- Commit: pending

### Step 2 - Merge And Push

- Command: `git commit -m "docs(ops): add 0373 fast static docs deploy" ...`
- Key output: implementation commit created for fast deploy script, docs, tests, and iteration records.
- Command: `git checkout dev && git merge --no-ff dropx/0373-fast-static-doc-deploy -m "merge: 0373 fast static docs deploy"`
- Key output: merge completed.
- Command: `git checkout main && git merge --no-ff dev -m "merge: dev into main after 0373"`
- Key output: merge completed.
- Command: `node scripts/tests/test_0373_cloud_public_docs_fast_deploy_contract.mjs`
- Key output: `2 passed, 0 failed out of 2`.
- Command: `node scripts/tests/test_0353_slide_app_runtime_docs_publish_contract.mjs`
- Key output: `5 passed, 0 failed out of 5`.
- Command: `node scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs`
- Key output: `7 passed, 0 failed out of 7`.
- Command: `node scripts/tests/test_0349_remote_deploy_sync_contract.mjs`
- Key output: `PASS test_0349_remote_deploy_sync_contract`.
- Command: `git push origin dev main`
- Key output: `dev -> dev`, `main -> main`.
- Result: PASS
- Commit: `d432c56`

### Step 3 - Remote Fast Deploy And Public Verification

- Command: `bash scripts/ops/deploy_cloud_public_docs_fast.sh --ssh-user drop --ssh-host dongyudigital.com --remote-repo /home/wwpic/dongyuapp --remote-repo-owner wwpic --revision "$(git rev-parse --short HEAD)"`
- Key output: failed before mutation; SSH connection closed by local proxy path `127.0.0.1:7897`.
- Command: `bash scripts/ops/deploy_cloud_public_docs_fast.sh --ssh-user drop --ssh-host 124.71.43.80 --remote-repo /home/wwpic/dongyuapp --remote-repo-owner wwpic --revision "$(git rev-parse --short HEAD)"`
- Key output: source sync used archive fallback, then `sync-ui-public-docs` wrote docs/static files to `/home/wwpic/dongyu/volume/persist/ui-server`; remote HTML sha256 `eea53d22d84188c642c8f8361d147f5f12f5e0532194008cbb839233d7f00ba5`.
- Command: `curl -L --max-time 20 -o /tmp/dy-static-index.html -w '%{http_code} %{url_effective}\n' https://app.dongyudigital.com/p/slide-app-runtime-minimal-submit-provider/`
- Key output: `200 https://app.dongyudigital.com/p/slide-app-runtime-minimal-submit-provider/`; content contains "Submit 类提交按钮如何准备模型表".
- Command: `curl -L --max-time 20 -o /tmp/dy-static-interactive.html -w '%{http_code} %{url_effective}\n' https://app.dongyudigital.com/p/slide-app-runtime-minimal-submit-provider/minimal_submit_app_provider_interactive.html`
- Key output: `200 https://app.dongyudigital.com/p/slide-app-runtime-minimal-submit-provider/minimal_submit_app_provider_interactive.html`; downloaded sha256 matches local sha256 `eea53d22d84188c642c8f8361d147f5f12f5e0532194008cbb839233d7f00ba5`.
- Command: Playwright open remote interactive HTML, click "4. 提交按钮", screenshot.
- Key output: Playwright snapshot shows "Submit 类提交按钮如何准备模型表", button Cell labels, root entry labels, egress labels, status/result labels, effect order, and multi-button naming.
- Artifact: `output/playwright/0373-remote-static-minimal-submit-docs.png`
- Result: PASS
- Commit: `d432c56`

## Docs Updated

- [x] `scripts/ops/README.md` updated
- [x] `docs/deployment/cloud_public_docs_fast_deploy.md` added
- [x] `docs/README.md` updated

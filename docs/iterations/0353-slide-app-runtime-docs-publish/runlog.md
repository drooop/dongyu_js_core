---
title: "0353 Slide App Runtime Docs Publish Runlog"
doc_type: iteration_runlog
status: completed
updated: 2026-04-30
source: codex
---

# 0353 Slide App Runtime Docs Publish Runlog

## 2026-04-30

- Registered iteration 0353 on branch `dev_0353-slide-app-runtime-docs-publish`.
- Done criteria: remote docs UI entry, direct static HTML URL, deterministic test, and browser verification.
- Added `scripts/ops/sync_ui_public_docs.sh` to publish the slide app runtime Markdown docs and static interactive HTML into the ui-server persisted docs/static roots.
- Wired the docs sync into local deploy, cloud full deploy, and cloud ui-server deploy; added slide-app-runtime docs to cloud source archive fallback.
- Added Workspace cellwise UI entry `Minimal Submit App Provider Docs` as Model 1039 and linked:
  - Markdown Docs UI: `/#/docs`
  - Static HTML: `/p/slide-app-runtime-minimal-submit-provider/`
- Added 0353 deterministic contract test covering:
  - docs/static copy behavior
  - Workspace docs model is `cellwise.ui.v1`
  - static HTML link is modeled
  - server can open the published Markdown and list the static project
  - deploy/asset sync scripts include the public docs path
- Remote first-pass browser verification found Model 1039 visible in registry but not mounted into Workspace. Root cause: remote persisted Model 1038 already occupied `Model 0 / p2,r0,c18`.
- Changed Model 1039 mount to canonical `runtime_hierarchy_mounts.json` at `Model 0 / p2,r0,c19`; the docs UI patch no longer owns hierarchy mounts.
- Deployed `cfbdc4c` to remote ui-server. Deployment output:
  - remote preflight gate: PASS
  - ui-server Docker build: PASS
  - rollout: PASS
  - target source hash gate: PASS
- Remote runtime snapshot after deploy:
  - `Model 0 / p2,r0,c18 = 1038`
  - `Model 0 / p2,r0,c19 = 1039`
  - `Model 1039 app_name = Minimal Submit App Provider Docs`
- Browser verification with Playwright against `https://app.dongyudigital.com`:
  - `/p/slide-app-runtime-minimal-submit-provider/`: opened, typed `remote docs 0353`, clicked submit, observed `Submitted: remote docs 0353`.
  - `/#/docs`: searched `minimal_submit_app_provider`, observed both `minimal_submit_app_provider_guide.md` and `minimal_submit_app_provider_visualized.md`.
  - `/#/workspace`: opened `Minimal Submit App Provider Docs`, observed `Open Interactive HTML` and `/p/slide-app-runtime-minimal-submit-provider/`.
- Browser screenshots saved under `output/playwright/` for local evidence:
  - `0353-remote-static-provider-docs.png`
  - `0353-remote-docs-ui-search.png`
  - `0353-remote-workspace-provider-docs.png`

## Verification Commands

- `node scripts/tests/test_0353_slide_app_runtime_docs_publish_contract.mjs`
- `node scripts/tests/test_0351_slide_app_minimal_provider_guide_contract.mjs`
- `node scripts/tests/test_0352_slide_app_provider_visualized_docs_contract.mjs`
- `node scripts/validate_ui_ast_v0x.mjs --case all`
- `npm -C packages/ui-model-demo-frontend run build`
- `git diff --check`
- Playwright browser flow against `https://app.dongyudigital.com`

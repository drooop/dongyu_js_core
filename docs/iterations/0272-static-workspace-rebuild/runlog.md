---
title: "Iteration 0272-static-workspace-rebuild Run Log"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0272-static-workspace-rebuild
id: 0272-static-workspace-rebuild
phase: phase3
---

# Iteration 0272-static-workspace-rebuild Run Log

## Environment

- OS: macOS
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Branch: `dev_0272-static-workspace-rebuild`

### Review Gate Records (FACTS)
```text
Review Gate Record
- Iteration ID: 0272-static-workspace-rebuild
- Review Date: 2026-04-01
- Review Type: User
- Reviewer: user
- Review Index: 1
- Decision: Approved
- Notes: user approved using a positive Workspace app + child truth model while keeping the fixed /p/<projectName>/... rule.
```

## Implementation Facts

- Added new Workspace app host:
  - `Model 1011`
- Added new Static truth model:
  - `Model 1012`
- Added mount chain:
  - `Model 0 -> 1011`
  - `Model 1011 -> 1012`
- Rebuilt Static page UI under `Model 1011`
- Moved Static truth ownership from old `-2`-only coupling to positive truth `1012`
- Preserved serving rule:
  - `/p/<projectName>/...`

## Script Verification (FACTS)

Executed and PASS:

- `node scripts/tests/test_0272_static_workspace_contract.mjs`
- `node scripts/tests/test_0272_static_workspace_ui_contract.mjs`
- `node scripts/tests/test_0272_static_action_ownership_contract.mjs`
- `node scripts/tests/test_0272_static_remote_action_contract.mjs`
- `node scripts/tests/test_0272_static_publish_path_contract.mjs`
- `node scripts/tests/test_0272_static_doc_contract.mjs`

## Deploy / Live Verification (FACTS)

Redeploy:

- `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- `bash scripts/ops/check_runtime_baseline.sh` -> `baseline ready`

Live snapshot checks:

- Workspace registry:
  - `curl -s http://localhost:30900/snapshot | jq '.snapshot.models["-2"].cells["0,0,0"].labels.ws_apps_registry.v | map({model_id, name})'`
  - includes `1011 Static`
- Static truth:
  - `curl -s http://localhost:30900/snapshot | jq '.snapshot.models["1012"].cells["0,0,0"].labels | {static_project_name: .static_project_name.v, static_upload_kind: .static_upload_kind.v, static_status: .static_status.v, mounted_path_prefix: .mounted_path_prefix.v}'`
  - result included:
    - `static_upload_kind = "zip"`
    - `mounted_path_prefix = "/p/"`

### Real HTML upload

- Opened Workspace -> `Static`
- Set project name:
  - `viz-filltable-html`
- Set upload kind:
  - `HTML`
- Uploaded:
  - `docs/user-guide/workspace_ui_filltable_example_visualized.html`
- Observed in truth:
  - `static_media_uri = "mxc://localhost/PmItGyMLNhSzEbafqAvLUweJ"`
- Clicked `Upload`
- Page status became:
  - `uploaded: viz-filltable-html`
- Project list showed:
  - `viz-filltable-html /p/viz-filltable-html/`
- Verified mounted URL:
  - `curl -s -o /tmp/static_html_check.out -w '%{http_code}' http://localhost:30900/p/viz-filltable-html/`
  - status `200`
  - body starts with uploaded HTML document

### Real ZIP upload

- Built zip locally:
  - copied `workspace_ui_filltable_example_visualized.html` to `index.html`
  - zipped as `/tmp/viz-filltable-zip.zip`
- Set project name:
  - `viz-filltable-zip`
- Set upload kind:
  - `ZIP`
- Uploaded zip file
- Observed in truth:
  - `static_media_uri = "mxc://localhost/UXbCJjwnLxgaiNXZHttOfYGW"`
- Clicked `Upload`
- Page status became:
  - `uploaded: viz-filltable-zip`
- Project list showed:
  - `viz-filltable-zip /p/viz-filltable-zip/`
- Verified mounted URL:
  - `curl -s -o /tmp/static_zip_check.out -w '%{http_code}' http://localhost:30900/p/viz-filltable-zip/`
  - status `200`
  - body starts with uploaded HTML document from zip `index.html`

## Final Result

- New Static page is now a formal Workspace app (`1011`)
- Its runtime truth lives on a positive child model (`1012`)
- Uploading single HTML works
- Uploading ZIP works
- Mounted access remains `/p/<projectName>/...`
- Real validation used the Claude Code generated visualized HTML file

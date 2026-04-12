---
title: "0316 — slide-python-install-client-example Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-04-13
source: ai
iteration_id: 0316-slide-python-install-client-example
id: 0316-slide-python-install-client-example
phase: phase4
---

# 0316 — slide-python-install-client-example Runlog

## Environment

- Date: `2026-04-13`
- Branch: `dev_0316-slide-python-install-client-example`
- Runtime: docs + script execution + local real import verification

## Review Gate Record

### Review 1 — User

- Iteration ID: `0316-slide-python-install-client-example`
- Review Date: `2026-04-13`
- Review Type: `User`
- Review Index: `1`
- Decision: **Approved**
- Notes:
  - 需要一个同事可直接使用的 Python 示例
  - 示例必须走当前正式主线，不走自定义 room message

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed

## Execution Record

### 2026-04-13 — Step 1 TDD Red

**Test added**
- `scripts/tests/test_0316_slide_python_install_client_contract.mjs`

**Command**
- `node scripts/tests/test_0316_slide_python_install_client_contract.mjs` → FAIL

**Red reason**
- Python 脚本与说明页尚不存在

### 2026-04-13 — Step 2 Example Script And Doc

**Created**
- `scripts/examples/slide_app_install_client.py`
- `docs/user-guide/slide_python_install_client_v1.md`

**Updated**
- `docs/user-guide/README.md`

**Delivered**
- Python 脚本按当前正式安装链执行：
  - 可选 `/auth/login`
  - `/api/runtime/mode`
  - `/api/media/upload`
  - `ui_owner_label_update` 写 `1031.slide_import_media_uri`
  - importer `click` pin
  - `/snapshot` 验证导入结果

### 2026-04-13 — Step 3 Deterministic Verification

**Commands**
- `node scripts/tests/test_0316_slide_python_install_client_contract.mjs` → PASS
- `python3 scripts/examples/slide_app_install_client.py --help` → PASS
- `python3 -m py_compile scripts/examples/slide_app_install_client.py` → PASS
- `node scripts/ops/obsidian_docs_audit.mjs --root docs` → PASS

### 2026-04-13 — Step 4 Local Real Import Verification

**Command**
- `python3 scripts/examples/slide_app_install_client.py --base-url http://127.0.0.1:30900 --zip test_files/executable_import_app.zip` → PASS

**Observed**
- upload uri:
  - `mxc://localhost/iTmWZYraqnuIPIkbXMuSPIyq`
- imported app:
  - `Executable Import App`
- imported model id:
  - `1046`
- Workspace registry 命中：
  - `model_id=1046`
  - `slide_surface_type=workspace.page`

### 2026-04-13 — Post-verify Script Hardening

**Observed**
- 首轮真验时，脚本在两个地方不够稳：
  - 未先切 `runtime_mode=running`
  - 遇到同名 app 时，可能先匹配到旧 registry 条目

**Action**
- `slide_app_install_client.py`
  - 增加 `POST /api/runtime/mode`
  - 改成优先按 `last_app_id` 匹配 Workspace registry
  - 对 registry 刷新增加短轮询

**Re-Verification**
- `node scripts/tests/test_0316_slide_python_install_client_contract.mjs` → PASS
- `python3 -m py_compile scripts/examples/slide_app_install_client.py` → PASS
- `python3 scripts/examples/slide_app_install_client.py --base-url http://127.0.0.1:30900 --zip test_files/executable_import_app.zip` → PASS

**Stable result**
- `last_app_id = 1046`
- `registry_match.model_id = 1046`

## Living Docs Review

- `docs/ssot/runtime_semantics_modeltable_driven.md`
  - reviewed, no change needed
- `docs/user-guide/modeltable_user_guide.md`
  - reviewed, no change needed
- `docs/ssot/execution_governance_ultrawork_doit.md`
  - reviewed, no change needed

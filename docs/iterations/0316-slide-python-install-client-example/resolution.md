---
title: "0316 — slide-python-install-client-example Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-04-13
source: ai
iteration_id: 0316-slide-python-install-client-example
id: 0316-slide-python-install-client-example
phase: phase4
---

# 0316 — slide-python-install-client-example Resolution

## Execution Strategy

1. 先补失败测试，锁定示例脚本必须走当前正式安装链。
2. 再实现 Python 脚本与说明页。
3. 最后用本地 server 做一次真实导入验证，并更新迭代记录。

## Step 1

- Scope:
  - 锁定脚本的正式安装链合同
- Files:
  - `scripts/tests/test_0316_slide_python_install_client_contract.mjs`
- Verification:
  - 初始测试必须失败
- Acceptance:
  - 测试能锁定：
    - 脚本存在
    - 使用 `/api/media/upload`
    - 使用 `ui_owner_label_update`
    - 写入 `slide_import_media_uri`
    - 触发 importer `click` pin
- Rollback:
  - 删除新增测试

## Step 2

- Scope:
  - 实现示例脚本和说明页
- Files:
  - `scripts/examples/slide_app_install_client.py`
  - `docs/user-guide/slide_python_install_client_v1.md`
  - `docs/user-guide/README.md`
- Verification:
  - `python3 scripts/examples/slide_app_install_client.py --help`
  - `python3 -m py_compile scripts/examples/slide_app_install_client.py`
- Acceptance:
  - 同事有脚本可跑，有文档可照着填参数
- Rollback:
  - 删除脚本和说明页

## Step 3

- Scope:
  - 本地真验与记录
- Files:
  - `docs/iterations/0316-slide-python-install-client-example/runlog.md`
- Verification:
  - `node scripts/tests/test_0316_slide_python_install_client_contract.mjs`
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
  - 真实运行 Python 脚本导入一个现成 zip
- Acceptance:
  - 本地导入成功，有可复核输出
- Rollback:
  - 回退本轮改动

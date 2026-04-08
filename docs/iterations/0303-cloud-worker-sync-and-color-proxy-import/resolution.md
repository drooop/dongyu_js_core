---
title: "0303 — cloud-worker-sync-and-color-proxy-import Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-04-09
source: ai
iteration_id: 0303-cloud-worker-sync-and-color-proxy-import
id: 0303-cloud-worker-sync-and-color-proxy-import
phase: phase4
---

# 0303 — cloud-worker-sync-and-color-proxy-import Resolution

## Execution Strategy

- 本 iteration 进入 Phase 3 后，按两条线并行收口：
  1. cloud worker 同步并恢复公网颜色生成器
  2. 颜色生成器代理 zip 示例产出与导入验证
- 执行顺序固定为：
  1. 写失败测试锁定导入包合同
  2. 生成代理 payload 与 zip
  3. 本地导入验证
  4. cloud worker rollout 与公网颜色生成器验证
  5. 公网导入验证与 closure
- 执行中允许的最小兼容修复：
  - 若公网持久化状态保留旧版 `Model 100 dual_bus_model`，允许在 `ui-server` 内补 canonical `model0_egress_*` 字段
  - 该修复只恢复既有合同，不扩导入协议，不改颜色生成器业务语义

## Step 1

- Scope:
  - 先写失败测试，锁定颜色生成器代理包合同
- Files:
  - `scripts/tests/test_0303_color_generator_proxy_import_contract.mjs`
  - `scripts/tests/test_0303_color_generator_proxy_import_server_flow.mjs`
- Verification:
  - 测试初始必须失败
  - 合同至少覆盖：
    - `test_files/` 下存在源 payload 与 zip
    - root metadata 符合 `0302`
    - `ui_bind_json` 正确指向现有 `Model 100` / `Model -2`
- Acceptance:
  - 对代理导入例子的成功口径已经被测试固定
- Rollback:
  - 回退新测试

## Step 2

- Scope:
  - 生成颜色生成器代理 payload 与 zip
- Files:
  - `test_files/color_generator_proxy_app_payload.json`
  - `test_files/color_generator_proxy_import.zip`
- Verification:
  - zip 中只包含一个 JSON
  - payload root labels 包含：
    - `app_name`
    - `source_worker`
    - `slide_capable=true`
    - `slide_surface_type=workspace.page`
    - `from_user`
    - `to_user`
    - `ui_authoring_version`
    - `ui_root_node_id`
- Acceptance:
  - `test_files/` 中有可手动上传的标准包
- Rollback:
  - 回退 payload 与 zip

## Step 3

- Scope:
  - 本地导入并验证代理 app 行为
- Files:
  - `docs/iterations/0303-cloud-worker-sync-and-color-proxy-import/runlog.md`
- Verification:
  - 本地导入后 Workspace 新增 app
  - 打开后能看到与颜色生成器一致的颜色值、输入框、按钮
  - 点击 `Generate Color` 后，底层仍由现有 `Model 100` 处理
- Acceptance:
  - 本地导入链与功能一致性成立
- Rollback:
  - 删除导入 app，清理本地状态

## Step 4

- Scope:
  - 同步 cloud `mbr-worker` / `remote-worker` 并恢复公网颜色生成器
- Files:
  - `docs/iterations/0303-cloud-worker-sync-and-color-proxy-import/runlog.md`
- Verification:
  - cloud `mbr-worker` / `remote-worker` pod 内源码哈希与当前 revision 一致
  - 公网颜色生成器重新可用
- Acceptance:
  - 公网颜色生成器链路恢复
- Rollback:
  - 回滚 cloud worker 到前一已知 revision

## Step 5

- Scope:
  - 公网导入颜色生成器代理包并完成 closure
- Files:
  - `docs/iterations/0303-cloud-worker-sync-and-color-proxy-import/runlog.md`
  - `docs/ITERATIONS.md`
- Verification:
  - 公网 Workspace 可导入该 zip
  - 新 app 打开后与颜色生成器行为一致
  - 删除后不留下垃圾状态
- Acceptance:
  - 0303 正式收口
- Rollback:
  - 删除导入 app，必要时回滚 cloud worker

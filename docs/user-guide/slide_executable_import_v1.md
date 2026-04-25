---
title: "Slide Executable Import v1"
doc_type: user-guide
status: active
updated: 2026-04-21
source: ai
---

# Slide Executable Import v1

## 当前已经可以做什么

- 导入的 slide app 现在可以携带 runtime `func.js`
- 前端节点可以直接把事件写到当前 cell 的 pin
- 导入 app 里目前支持两类最小业务：
  - 同 cell `func.js`
  - 按 pin 链继续走到 root / helper，再完成后端写入

## 当前明确不做什么

- 不支持 `func.python`
- 不支持 `pin.bus.in`
- 不支持 `pin.bus.out`
- 不支持 `pin.connect.model`
- 不支持覆盖系统 helper / privilege labels：
  - `scope_privileged`
  - `helper_executor`
  - `owner_apply`
  - `owner_apply_route`
  - `owner_materialize`
  - 任意 `run_*`
- 不支持浏览器侧任意 `eval` / 任意 JS 片段执行

## v1 的最小示例

仓库内现在有一份固定示例包：

- `test_files/executable_import_app_payload.json`
- `test_files/executable_import_app.zip`

这个包提供两个按钮：

- `Run Local Logic`
  - 当前 cell 直接触发 imported `func.js`
  - 最终把状态写成 `local_processed`
- `Run Request Chain`
  - 当前 cell 先把事件送到 root pin
  - root 程序模型再继续走 helper pin 链
  - 最终把状态写成 `chain_processed`

## 最短验证步骤

1. 打开 `/#/workspace`
2. 打开 `滑动 APP 导入`
3. 上传 `test_files/executable_import_app.zip`
4. 点击 `导入 Slide App`
5. 打开 `Executable Import App`
6. 点击 `Run Local Logic`
7. 确认状态变成 `local_processed`
8. 再点击 `Run Request Chain`
9. 确认状态变成 `chain_processed`

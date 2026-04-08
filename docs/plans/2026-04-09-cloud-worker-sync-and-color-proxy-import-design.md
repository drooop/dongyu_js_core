---
title: "Cloud Worker Sync And Color Proxy Import Design"
doc_type: plan
status: active
updated: 2026-04-09
source: ai
---

# Cloud Worker Sync And Color Proxy Import Design

## Goal

把 cloud 上落后的 `mbr-worker / remote-worker` 同步到当前代码，并产出一个可导入的颜色生成器代理 zip 示例。

## Chosen Approach

- cloud 修复：
  - 以当前 branch revision 为准，单独核对 `ui-server / mbr-worker / remote-worker` pod 内源码哈希
  - 对落后的 worker 做最小 rollout
- 导入示例：
  - 不复制颜色生成器逻辑
  - 新导入 app 只作为一个新的 Workspace 入口
  - 它的 `ui_bind_json` 继续直接读写现有 `Model 100 / Model -2`

## Why This Approach

- 不扩 `0302` 合同。
- 不复制一套新的 worker 流程。
- 导入包更稳定，因为底层仍然是当前正式颜色生成器。

## Done Criteria

- 公网颜色生成器重新可用。
- `test_files/` 下存在颜色生成器代理 payload + zip。
- 本地和公网导入该 zip 后，都能打开一个“与颜色生成器功能一致”的新 app。

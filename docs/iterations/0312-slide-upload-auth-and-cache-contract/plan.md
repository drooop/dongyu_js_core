---
title: "0312 — slide-upload-auth-and-cache-contract Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0312-slide-upload-auth-and-cache-contract
id: 0312-slide-upload-auth-and-cache-contract
phase: phase1
---

# 0312 — slide-upload-auth-and-cache-contract Plan

## Goal

- 把 slide 导入上传时的鉴权模式和 media cache-priming 前提冻结成正式合同，并补自动化测试，避免 0309 文档继续靠 review 反复校正。

## Scope

- In scope:
  - `/api/media/upload` 在“开启鉴权 / 未开启鉴权”两种环境下的正式说明
  - `slideImportAppFromMxc()` 对“当前 ui-server 已缓存媒体”的正式说明
  - 1 个上传鉴权合同测试
  - 1 个 media cache-priming 合同测试
  - 1 个正式合同页与导航入口
- Out of scope:
  - 不修改上传逻辑行为
  - 不修改 slide 导入逻辑行为
  - 不新增外部 Matrix room message 协议
  - 不扩展导入能力到“任意外部 mxc URI 都可直接使用”

## Invariants / Constraints

- 只冻结当前 live code 已存在的行为，不借机改产品逻辑。
- `0308/0310/0311` 后的正式入口仍然是：
  - Matrix media `mxc://...`
  - importer pin-chain
- 开启页面鉴权时：
  - 未登录上传必须先报 `not_authenticated`
- 未开启页面鉴权时：
  - server 侧 Matrix 凭据才允许参与上传兜底
- `slideImportAppFromMxc()` 继续要求：
  - `mxc://...` 已被当前 ui-server cache priming

## Success Criteria

1. 有一页正式合同文档，能清楚说明：
   - 两种鉴权模式的上传前提
   - `not_authenticated`
   - `matrix_session_missing`
   - `media_not_cached`
   - cache priming 的唯一受支持入口
2. 有自动化测试固定：
   - 上传路由的鉴权顺序与 fallback 边界
   - slide 导入对 cache priming 的依赖
3. `0309` 正式说明能把复杂边界外链给新的合同页，而不是自己重复解释所有细节。

## Inputs

- Created at: 2026-04-10
- Iteration ID: `0312-slide-upload-auth-and-cache-contract`
- Background:
  - `0309` 在 review 中连续暴露同一块边界歧义
  - 需要把该边界从“说明页文字”升级成“正式合同 + 自动化证据”

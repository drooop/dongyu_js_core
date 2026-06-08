---
title: "Iteration 0410 Slide Import and Async Host Actions Plan"
doc_type: iteration_plan
status: completed
updated: 2026-06-08
source: ai
---

# Iteration 0410 Plan

## 0. Metadata
- ID: 0410-slide-import-async-host-actions
- Date: 2026-06-08
- Owner: Codex
- Branch: dropx/dev_0410-slide-import-async-host-actions
- Related:
  - `docs/iterations/0312-slide-upload-auth-and-cache-contract/`
  - `docs/iterations/0397-matrix-suite-live-test-slide-app/`
  - `docs/iterations/0403-zitadel-sso-authz-gateway/`

## 1. Goal
让滑动 App 导入入口可用，并让普通按钮操作不再被慢速 Matrix/管理总线外部动作拖到半分钟级等待。

## 2. Background
用户反馈两个当前缺陷：用于导入滑动 App 的滑动 App 无法导入；其他操作虽然权限已可用，但按钮响应需要等待半分钟到一分钟。调查中复现到服务端 `tick()` 会等待所有挂起的 Matrix host action，导致一个慢外部请求阻塞普通本地按钮。

## 3. Invariants (Must Not Change)
- UI 业务事件仍必须经 Model 0 系统总线边界进入。
- 滑动 App 导入仍必须使用 upload -> media cache -> Model 0 bus event -> importer truth model -> import click 的正式链路。
- Matrix/管理总线动作仍必须以当前请求 session 身份执行，不能回退到全局 token。
- 普通用户权限与 capability gate 不放宽；本次只处理已授权用户的可用性和响应性能。
- 不修改远端集群运行时、网络、系统服务或防火墙。

## 4. Scope
### 4.1 In Scope
- 修复或收紧 slide import file input / bus_event_v2 相关测试与实现，使上传后的 media URI 能进入正式导入链路。
- 调整服务端 host action 等待策略，使慢速 Matrix/管理总线动作异步完成，不阻塞无关 UI 操作。
- 补充性能回归测试，证明慢 Matrix action 不会拖慢普通本地按钮。
- 重新跑导入、Matrix Chat/Matrix Suite、权限相关的代表性测试。

### 4.2 Out of Scope
- 不重做 SSO/OIDC 登录设计。
- 不新增 Matrix 功能或改动真实房间权限模型。
- 不改变 ModelTable 权限合同。
- 不进行云端发布，除非用户之后明确要求。

## 5. Non-goals
本次不追求改造整个事件循环，也不追求为所有外部 host action 做统一任务队列产品化 UI；只修复当前可见卡顿和导入入口不可用。

## 6. Success Criteria (Definition of Done)
- `scripts/tests/test_0276_fileinput_picker_contract.mjs` 通过。
- 新增性能回归测试能在修复前失败、修复后通过，断言慢 Matrix host action 不会阻塞普通本地按钮。
- slide import 代表性链路测试通过。
- Matrix Chat/Matrix Suite 代表性测试仍通过。
- 本地已部署环境完成一次可观测验证，普通按钮不再出现半分钟级等待。

## 7. Risks & Mitigations
- Risk: host action 改为异步后，既有测试可能假设 `submitEnvelope` 返回时 Matrix 结果已写入。
  - Impact: 测试失败或 UI 状态短暂显示 loading。
  - Mitigation: 保持 host action 完成后触发 snapshot refresh；测试改为等待异步状态落地。
- Risk: 不等待 host action 可能隐藏 Matrix 错误。
  - Impact: 用户看不到外部请求失败。
  - Mitigation: 保留 host action 的 error/status 写回和 snapshot change 通知。
- Risk: 导入失败可能同时有权限/session 因素。
  - Impact: 单纯修复上传链路不足以解决所有用户态失败。
  - Mitigation: 自动化测试覆盖无认证隔离状态，浏览器/本地环境再验证已登录态。

## 8. Open Questions
None.

## 9. Compliance Checklists

### 9.1 SSOT Alignment Checklist
- SSOT references:
  - `CLAUDE.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/tier_boundary_and_conformance_testing.md`
- Notes:
  - 本次保持 Model 0 bus ingress 与 pin routing，不引入 UI 直写业务状态。

### 9.2 Charter Compliance Checklist
- Charter references:
  - `docs/WORKFLOW.md`
- Notes:
  - 用户已要求继续修复当前缺陷；按 hotfix 处理，并补齐 plan/resolution/runlog。

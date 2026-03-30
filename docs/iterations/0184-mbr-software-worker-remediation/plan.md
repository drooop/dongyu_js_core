---
title: "Iteration 0184-mbr-software-worker-remediation Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0184-mbr-software-worker-remediation
id: 0184-mbr-software-worker-remediation
phase: phase1
---

# Iteration 0184-mbr-software-worker-remediation Plan

## Goal

把 `MBR` 收口成严格的软件工人实现：桥接必须建立在合法数据链路之上，确保 `ui-server -> Matrix -> MBR -> MQTT -> remote-worker -> patch_out -> MBR -> Matrix -> ui-server` 在远端真实环境下闭环，并消除当前“只看到 mbr_ready、看不到 submit 回包”的断链问题。

## Scope

- In scope:
  - 复核并修正 `MBR` 的 Matrix 接收条件、bridge contract 和 route-to-MQTT 行为
  - 验证 `MBR` 是否真的与 `ui-server` 监听同一 DM 房间 / 同一 sender / 同一事件类型
  - 若需要，修正 `mbr_role_v0.json`、`run_worker_v0.mjs`、相关 contract tests
  - 让远端 `Model 100` 颜色生成器重新跑通，并用真实浏览器和脚本同时验收
  - 顺带检查 `MBR` 是否符合“软件工人实现（尤其数据链路合法性）”要求
- Out of scope:
  - 不扩大到通用业务桥接设计重写
  - 不修改前端产品功能语义，除非为了暴露/诊断 `MBR` 链路必需
  - 不重构 `remote-worker` 业务逻辑本身，只处理其与 `MBR` 的 contract/镜像对齐问题

## Invariants / Constraints

- `MBR` 必须作为负数系统模型承载的 helper/bridge worker，不得把非法 bridge 权限下放到正数业务模型。
- `MBR` 只允许桥接合法的业务事件链，不得恢复 generic CRUD / create_model / cell_clear 的兼容路径。
- 数据链路必须可审计：
  - 输入从 Matrix `dy.bus.v0`
  - 经 `mbr_mgmt_inbox -> mbr_mgmt_to_mqtt`
  - 发往合法 topic
  - 回包经 `mbr_mqtt_inbox -> mbr_mqtt_to_mgmt -> change_out`
- 若发现当前实现本质上还是旧式 records bridge，而非严格软件工人链路，必须明确记为规约债或直接修正。
- 远端操作继续遵守 `rke2` 安全边界，不碰 `k3s/systemctl/rancher/CNI`。

## Success Criteria

- 能明确回答并用证据证明：
  - `MBR` 是否接收到 `@drop` 发到目标 DM 房间的 `ui_event`
  - `MBR` 是否把 `Model 100 submit` 发往正确 MQTT topic
  - `remote-worker` 是否收到该 topic 并回发 `patch_out`
- 至少一条新的 `0184` 合同测试先红后绿，锁定本轮真实根因。
- 远端浏览器再次通过颜色生成器真实点击，颜色发生变化。
- `bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url https://app.dongyudigital.com` PASS。
- 迭代 runlog 记录本轮真实根因，而不是只记录“重启后好了”。

## Inputs

- Created at: 2026-03-11
- Iteration ID: 0184-mbr-software-worker-remediation
- Approval: user explicitly approved “MBR 规约收口” and asked to continue on 2026-03-11

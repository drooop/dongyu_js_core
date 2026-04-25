---
title: "Iteration 0184-mbr-software-worker-remediation Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0184-mbr-software-worker-remediation
id: 0184-mbr-software-worker-remediation
phase: phase1
---

# Iteration 0184-mbr-software-worker-remediation Resolution

## Execution Strategy

先做证据驱动定位，把问题从“颜色不变”压缩到 `MBR` 具体桥接断点；再用失败测试锁住真实根因，最后做最小实现修复，并在远端用真实浏览器 + roundtrip 脚本复验。

## Step 1

- Scope:
  - 登记 `0184`
  - 落 Goal / Scope / Invariants / Success Criteria
  - 在 runlog 中记录 Review Gate = Approved
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0184-mbr-software-worker-remediation/plan.md`
  - `docs/iterations/0184-mbr-software-worker-remediation/resolution.md`
  - `docs/iterations/0184-mbr-software-worker-remediation/runlog.md`
- Verification:
  - `rg -n "0184-mbr-software-worker-remediation" docs/ITERATIONS.md docs/iterations/0184-mbr-software-worker-remediation/*.md`
- Acceptance:
  - `0184` 已登记且无 `[TODO]`
- Rollback:
  - 删除 `0184` 目录和索引项

## Step 2

- Scope:
  - 做 `MBR` 链路事实定位
  - 确认断点是在 `Matrix receive`、`mbr_mgmt_to_mqtt`、`MQTT publish`、还是 `mbr_mqtt_to_mgmt`
  - 写失败测试锁定真实根因
- Files:
  - `scripts/tests/test_0184_*.mjs`
  - 可能补充到 `scripts/tests/test_0179_mbr_route_contract.mjs`
- Verification:
  - 新测试先 FAIL，且失败原因直接对应本轮观察到的链路断点
- Acceptance:
  - 不再是“猜 MBR 有问题”，而是有一条确定的红灯合同
- Rollback:
  - 删除新增测试

## Step 3

- Scope:
  - 最小修复 `MBR` 实现或 patch 数据
  - 确保它按软件工人规约接收、转译和外发
- Files:
  - `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`
  - `scripts/run_worker_v0.mjs`
  - 如有必要，`packages/worker-base/src/matrix_live.js`
- Verification:
  - `node scripts/tests/test_0184_*.mjs`
  - `node scripts/tests/test_0177_mbr_bridge_contract.mjs`
  - `node scripts/tests/test_0179_mbr_route_contract.mjs`
  - `node scripts/validate_mbr_patch_v0.mjs`
- Acceptance:
  - `MBR` 的接收与桥接合同与规约一致，且红灯测试转绿
- Rollback:
  - 回退上述文件

## Step 4

- Scope:
  - 远端重新对齐 `mbr-worker` / `remote-worker` / `ui-server` 到当前实现
  - 用真实环境验证闭环
- Files:
  - `docs/iterations/0184-mbr-software-worker-remediation/runlog.md`
- Verification:
  - `bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url https://app.dongyudigital.com`
  - 浏览器真实点击 `Generate Color`
- Acceptance:
  - 颜色真实变化
  - `ui_event_last_op_id` 前进
  - 无 `ui_event_error`
- Rollback:
  - 记录远端回退 revision 或恢复备份 DB

## Step 5

- Scope:
  - 补 runlog / living docs 评估
  - 若发现当前 `MBR` 仍存在规约债，明确写入文档
- Files:
  - `docs/iterations/0184-mbr-software-worker-remediation/runlog.md`
  - 必要时更新 `docs/ssot/ui_to_matrix_event_flow.md`
  - 必要时更新 `docs/ssot/tier_boundary_and_conformance_testing.md`
- Verification:
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
- Acceptance:
  - 根因、修复、残余债都已落盘
- Rollback:
  - 回退本轮文档改动

## Notes

- Generated at: 2026-03-11

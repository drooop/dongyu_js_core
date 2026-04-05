---
title: "0292 — foundation-pin-payload-contract-freeze Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-06
source: ai
iteration_id: 0292-foundation-pin-payload-contract-freeze
id: 0292-foundation-pin-payload-contract-freeze
phase: phase1
---

# 0292 — foundation-pin-payload-contract-freeze Resolution

## Execution Strategy

- 本 iteration 仍是 docs-only，不做代码实现。
- 实施顺序固定为：
  1. 获取并落盘 Feishu “临时模型表”定义
  2. 冻结新合同 SSOT
  3. 盘点全仓受影响面
  4. 形成基础 B 的迁移策略草案

## Step 1

- Scope:
  - 通过 Feishu 访问能力获取“临时模型表”定义
  - 把该定义落盘到 repo SSOT
- Files:
  - `docs/ssot/temporary_modeltable_payload_v1.md`
  - `docs/iterations/0292-foundation-pin-payload-contract-freeze/runlog.md`
- Verification:
  - 必须记录来源链接
  - 必须明确 repo 版本成为权威
- Acceptance:
  - repo 中已有可引用的权威定义
- Rollback:
  - 回退新 SSOT 文档与本 iteration 文档

## Step 2

- Scope:
  - 冻结三条新合同：
    - 引脚归属程序模型
    - payload = 临时模型表
    - 不引入 `pin.table.*`
  - 明确 `pin.model.*` 去留
  - 明确 D0 / 非 D0 / 矩阵权限边界
- Files:
  - `docs/ssot/program_model_pin_and_payload_contract_vnext.md`
  - `docs/iterations/0292-foundation-pin-payload-contract-freeze/plan.md`
  - `docs/iterations/0292-foundation-pin-payload-contract-freeze/resolution.md`
- Verification:
  - 文档中必须明确：
    - 默认程序模型行为
    - 多引脚归属
    - `pin.model.*` 去留
    - D0 / 非 D0 / 矩阵权限
    - payload schema
- Acceptance:
  - 三条合同冻结清晰
- Rollback:
  - 回退新 SSOT 文档与本 iteration 文档

## Step 3

- Scope:
  - 盘点全仓影响面
- Files:
  - `docs/plans/2026-04-06-pin-payload-impact-inventory-and-migration.md`
  - `docs/iterations/0292-foundation-pin-payload-contract-freeze/runlog.md`
- Verification:
  - 至少覆盖：
    - runtime
    - `ui-server`
    - `remote-worker`
    - `MBR`
    - system-models
    - 验证脚本
    - `0283-0291`
- Acceptance:
  - 影响清单具备可执行价值
- Rollback:
  - 回退影响清单文档与本 iteration 文档

## Step 4

- Scope:
  - 形成基础 B 的迁移策略草案
- Files:
  - `docs/plans/2026-04-06-pin-payload-impact-inventory-and-migration.md`
  - `docs/iterations/0292-foundation-pin-payload-contract-freeze/runlog.md`
- Verification:
  - 文档中必须说明：
    - runtime 改造路径
    - system-models 迁移路径
    - 验证脚本更新路径
- Acceptance:
  - 基础 B 有明确入口，但不细到 Step 级实现
- Rollback:
  - 回退迁移策略文档与本 iteration 文档

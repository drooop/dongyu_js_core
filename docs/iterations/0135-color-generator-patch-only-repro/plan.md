# Iteration 0135-color-generator-patch-only-repro Plan

## Goal

在“`yhl.db` 视为空白状态”的前提下，用 JSON patch 文件复现一次 Model 100 颜色生成器 E2E 流程，并将“负数模型初始化加载 + 正数模型测试注入”固化为可复现文档。

## Scope

In scope:
- 使用独立 `WORKER_BASE_DATA_ROOT`，避免仓库内 `yhl.db` 二进制变更影响可复现性。
- 复验链路：UI Server -> Matrix -> MBR -> MQTT -> K8s Worker -> Matrix -> UI Server。
- 最终成功与否用 Playwright 实际操作验证。
- 更新 runbook：新增 patch-only 模式、证据路径、排障要点。

Out of scope:
- 修改业务语义（颜色生成规则、event/patch 协议含义）。
- 引入新的外部依赖。

## Invariants / Constraints

- 遵循 `AGENTS.md` 与 `docs/WORKFLOW.md`。
- 所有结论必须有命令输出或源码行号证据。
- 测试流程优先 JSON patch，不依赖预置 `yhl.db` 内容。

## Success Criteria

- API 复验在超时窗口内观察到 `bg_color` 变化（PASS/FAIL 可判定）。
- Playwright 终验结论与 API 复验一致。
- 文档明确写出两段加载机制，并给出代码证据文件与关键行。
- `docs/ITERATIONS.md` 与 `runlog.md` 状态一致。

## Inputs

- Created at: 2026-02-09
- Iteration ID: 0135-color-generator-patch-only-repro

# Iteration 0137-planA-layered-pressure-test Plan

## Goal

- 执行方案A分层测试，验证“空 DB 启动仅负数基座 patch + 运行中导入正数模型”在功能、一致性与压力下是否稳定。
- 识别链路问题并形成可复现证据（命令、输出、Playwright 结果、阈值判定）。

## Scope

- In scope:
- Step A：空 DB 启动前置状态验证（无正数模型，Workspace 空）。
- Step B：运行中导入 `1/2/100/1001/1002` 正数模型验证。
- Step C：Workspace 视图一致性验证（导入前后 UI 差异）。
- Step D：API 压力与链路稳定性验证（`/api/modeltable/patch`、`/ui_event`）。
- Step E：Playwright 终验（导入后可见并可交互）。
- Out of scope:
- 改造 K8s / Docker 拓扑与副本策略。
- 大规模并发（>200 qps）容量上限测试。

## Invariants / Constraints

- 遵循 `AGENTS.md` 与 `docs/WORKFLOW.md`。
- 测试阶段默认运行基线：Docker+K8s 常驻。
- `yhl.db` 在本次测试视为可重建空态；启动阶段不应自动出现正数模型。
- 正数模型仅通过运行中 patch 导入生成。
- 结论必须有 PASS/FAIL 判定与证据文件。

## Success Criteria

1. 导入前 snapshot 中正数模型数量为 0，`ws_apps_registry` 长度为 0。
2. 导入后 snapshot 至少包含 `1/2/100/1001/1002`，`ws_apps_registry` 长度为 5。
3. 幂等导入连续 5 次无失败，`ws_apps_registry` 不膨胀。
4. `ui_event` 压力样本 30 次全部成功，错误数为 0，p95 延迟 < 3000ms。
5. Playwright 终验通过：Workspace 导入前为空，导入后出现应用并可展示 Model 100 面板。

## Inputs

- Created at: 2026-02-09
- Iteration ID: 0137-planA-layered-pressure-test

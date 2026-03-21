---
title: "doit-auto orchestrator v1 retrospective"
doc_type: retrospective
status: active
updated: 2026-03-21
source: ai
---

# doit-auto orchestrator v1 retrospective

## 1. 结论

2026-03-21 的端到端演练已经证明 `doit-auto orchestrator v1` 可以在真实 CLI 环境下跑通完整主链路：

`Decompose -> INTAKE -> PLANNING -> REVIEW_PLAN -> EXECUTION -> REVIEW_EXEC -> COMPLETE -> Final Verification -> Batch complete`

本次最终成功 batch：

- Batch: `b6900088-56ba-4583-aa9d-53fafe93e731`
- Goal verdict: `ALL GOALS MET`
- Final verification: `passed`

这说明 orchestrator 已经从“静态设计 + mock 测试”进入“可用于真实小范围工作包”的状态。

## 2. 已验证能力

以下能力已被真实运行证明可用：

1. 自然语言需求分解：
   用户 prompt 可被分解成结构化 iteration，并正确初始化 batch。

2. Authoritative state + 恢复：
   `state.json` 作为唯一真源、`state.json.tmp` 恢复、orphaned event 检测、`reconcileDerivedDocs()`、`checkStateIterationsConsistency()` 已实际触发并验证。

3. Review Gate 自动化：
   `REVIEW_PLAN` 能通过 3 次独立 `APPROVED` 进入 `EXECUTION`。

4. Execution + repair loop：
   `REVIEW_EXEC` 已真实产生 `NEEDS_CHANGES (major)`，Codex 能据此补做缺失 Step，并回到后续 review。

5. Review 收敛：
   `REVIEW_EXEC` 最终达到 3 次连续 `APPROVED`，成功进入 `COMPLETE`。

6. On Hold / resume：
   `ambiguous`、CLI failure、branch guard 等路径都实际触发过 `On Hold`，并可通过恢复继续推进。

7. Branch/worktree guard：
   错误分支与脏工作区都被正确拦截，没有误执行。

8. Final Verification Gate：
   能对最终交付物做目标级验证，并把结果写回 `events.jsonl` 与 `state.json`。

## 3. 运行观察

本次成功 batch 并不是“一次就顺滑通过”，而是经历了多轮真实波动后收敛：

- `REVIEW_PLAN` 早期仍有 1 次 parse miss，但后续 3 连 `APPROVED` 通过。
- `REVIEW_EXEC` 早期多次出现 `error_max_turns`、1 次 `ambiguous`、1 次 parse miss。
- 在补 prompt、parser、turn budget 后，`REVIEW_EXEC` 收敛为：
  - `NEEDS_CHANGES (major)`
  - Codex 修复缺失 Step
  - 3 连 `APPROVED`
  - `COMPLETE`

这说明当前 orchestrator 的核心风险已经从“状态机设计错误”下降为“review 集成可用性仍需继续优化”。

## 4. 下一轮优化清单

### P1. 完成态收口不一致

这是下一条必须修的后续项。

现象：

- `events.jsonl` 已写出 `Batch complete`
- `final_verification = passed`
- 但 `state.json` / `status.txt` 仍可能停留在：
  - iteration `status=active`
  - iteration `phase=COMPLETE`
  - 看板 `Done: 0 / Active: 1`

要求：

- `handleCompletePhase` 和 batch 收尾逻辑必须把 iteration 最终落成 `status=completed`
- `status.txt` 应与 `state.json` 同步收口到 `Done: 1 / Active: 0`
- 完成态应只存在一份 authoritative 解释，不允许事件、state、看板三者不一致

### P2. REVIEW_EXEC 可用性继续收敛

虽然已经跑通，但仍出现过：

- `error_max_turns`
- `ambiguous`
- prose / JSON 混合输出

要求：

- 继续缩窄 `REVIEW_EXEC` 的审查范围，只看本 iteration 的 resolution steps 和交付文件
- 继续补 `parseVerdict()` 的 prose fallback，减少非结构化输出漏网
- 把 CLI failure、parse failure、turn budget exhaustion 分开统计，便于后续定位

### P3. 人工裁决机制显式化

当前恢复主要靠手动改 state 或重新运行。

要求：

- 给 `On Hold` 增加显式的人类裁决输入面
- 最少要能表达：
  - `resume as-is`
  - `force major`
  - `force minor`
  - `abort batch`

### P4. docs symlink / Git 集成边界澄清

本轮运行还暴露了 `docs/` 为 symlink 时的 Git 集成边界。

要求：

- 明确 `docs` symlink 下文件是否作为 orchestrator 的可交付工作面
- 若继续保留当前结构，需要把“文件存在于磁盘但不在 repo index”的情况写进限制说明

## 5. 下一轮实战锚点

### 推荐目标：`0164-playwright-readiness-fixes`

推荐把下一次 orchestrator 实战锚定到现有 iteration：

- ID: `0164-playwright-readiness-fixes`
- 入口：`docs/iterations/0164-playwright-readiness-fixes/`

选择原因：

1. 它是真实项目 iteration，不是专门为 orchestrator 造的演示任务。
2. 它是本地、定向、可脚本验证的工程问题，适合 v1。
3. 不涉及 `0183` 那类远端 deploy / 高风险主机操作。
4. 比 `0156` 这种大范围重构更适合作为“第一条真实代码实战”。

不建议作为下一锚点的目标：

- `0183-cloud-deploy-remote-build-split`
  原因：远端 / 集群 / deploy blast radius 过高。
- `0156-ui-renderer-component-registry`
  原因：范围过大、跨模块耦合高，不适合作为第一次真实代码迭代。

## 6. 建议推进节奏

建议按以下顺序推进：

1. 先修 `P1 完成态收口不一致`
2. 再做一次小规模 docs/code 混合 smoke，确认完成态收口正确
3. 然后用 orchestrator 接手 `0164-playwright-readiness-fixes`
4. 等 `0164` 跑通后，再考虑更大范围或更高风险 iteration

## 7. 成功判据（下一轮）

下一轮真正算“进入实战”的判据不是再跑一个 docs-only batch，而是：

1. `0164` 能在 orchestrator 下生成 plan/resolution
2. `REVIEW_PLAN` 与 `REVIEW_EXEC` 都能稳定收敛
3. targeted tests 先失败后通过
4. runlog / ITERATIONS / state / events 四份证据保持一致
5. 不依赖手工 patch state 才能继续

---

一句话总结：

`doit-auto orchestrator v1` 已经完成“从概念验证到真实可用”的跨越；下一步不是继续堆 docs-only 演练，而是先修完成态收口，再拿 `0164-playwright-readiness-fixes` 做第一条真实工程实战线。 

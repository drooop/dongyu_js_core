---
title: "Fill-Table-Only Mode（显式强制模式）"
doc_type: ssot
status: active
updated: 2026-03-21
source: ai
---

# Fill-Table-Only Mode（显式强制模式）

## 0. 定位
本文件定义一个执行治理模式：当任务被明确声明为“只能填表实现”时，进入 **Fill-Table-Only** 强制约束。

- 这是执行治理规则，不是 runtime 语义扩展。
- 上位约束仍是 `CLAUDE.md`。
- 本模式是 **opt-in**，不是仓库全局默认。

## 1. 目标
在显式填表任务中，阻止“改 runtime/改服务逻辑绕过填表”的实现路径，从而暴露真实的 runtime capability gap。

## 2. 激活条件（必须同时满足）
1. 任务语义显式要求“填表实现/只能填表/不要改 runtime”。
2. 执行命令显式开启模式：
   - `--mode fill-table-only`，或
   - 环境变量 `FILL_TABLE_ONLY=1`。

未开启模式时，门禁脚本必须返回 `[SKIP]`，不得误阻断普通任务。

## 3. 强制校验入口
脚本：`scripts/validate_fill_table_only_mode.mjs`

标准命令：
```bash
node scripts/validate_fill_table_only_mode.mjs --mode fill-table-only
```

在脏工作区下进行 scoped 校验：
```bash
node scripts/validate_fill_table_only_mode.mjs \
  --mode fill-table-only \
  --paths "docs/README.md,deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json"
```

## 4. 允许改动范围（白名单）
以下路径在 Fill-Table-Only 模式下允许变更：
- `deploy/sys-v1ns/**/*.json`
- `packages/worker-base/system-models/**/*.json`
- `docs/**`
- `.githooks/**`
- `scripts/ops/install_git_hooks.sh`
- `scripts/fill_table_only_mode_ctl.mjs`
- `scripts/tests/**/*.mjs`
- `scripts/validate_*.mjs`

说明：白名单强调“填表定义 + 治理/验证证据”，不包含 runtime/服务实现代码。

## 5. 禁止改动范围（示例）
以下属于典型违规（非穷举）：
- `packages/worker-base/src/runtime.js`
- `packages/worker-base/src/runtime.mjs`
- `packages/ui-model-demo-server/server.mjs`
- 任何不在白名单内的业务实现文件

## 6. 失败行为（必须）
一旦检测到非白名单变更，脚本必须：
- 输出 `[FAIL] fill-table-only guard`
- 列出违规文件路径
- 输出 `required_action=write_runtime_capability_gap_report`
- 以 exit code `1` 结束

禁止 silent fail，禁止“看起来差不多可以”这种人工裁决。

## 7. Runtime Capability Gap 报告要求
当 guard 失败且确认为能力缺口时，必须补充 capability gap 报告，最少包含：
- Target capability（想通过填表实现的能力）
- Why fill-table failed（缺的解释器能力/契约）
- Evidence（失败命令、违规文件、输出摘要）
- Minimal runtime change proposal（最小化基座变更）
- Risk / rollback（回滚与影响面）
- Why model-only workaround is insufficient（为何不能继续纯填表）

## 8. 与迭代流程的关系
- Phase 1：在 `plan.md`/`resolution.md` 明确本任务是否开启 Fill-Table-Only。
- Phase 3：执行步骤前运行 guard；提交前再次运行 guard。
- runlog 必须记录 guard 命令与关键输出。

## 9. 判定口径
- 只有在显式开启时才强制。
- 一旦开启，所有非白名单改动一律判 FAIL。
- 例外只能通过“能力缺口报告 + 新迭代审批”进入 runtime 修改路径。

## 10. 自动门禁（推荐：分支级自动启停）
目标：用户不需要手动 `on/off`。

本仓库采用 **分支级生命周期**：当工作分支名包含 `-ft-` 时，`pre-commit` 自动以 `--mode fill-table-only` 强制执行 guard；离开该分支自动解除。

推荐分支命名：`dev_<id>-ft-<desc>`（符合 `CLAUDE.md` 的分支规则，同时显式标记 Fill-Table-Only）。

### 10.1 安装 hook
```bash
bash scripts/ops/install_git_hooks.sh
```

该脚本会设置：
- `git config core.hooksPath .githooks`

### 10.2 pre-commit 执行语义
- 仅在分支名匹配 `(^|-)ft(-|$)` 时触发 guard。
- 只检查 **staged 文件**，避免被 unstaged/历史脏工作区误伤。
- 违规时 commit 失败，并输出 `required_action=write_runtime_capability_gap_report`。

### 10.3 `$ft` skill 触发语义（推荐用法）
- 用户输入 `$ft ...` 后，AI 必须自动创建/切换到 `dev_<id>-ft-<desc>` 分支，并按 Fill-Table-Only 规则推进实现与验证。
- 用户无需手动执行任何 `on/off` 命令。

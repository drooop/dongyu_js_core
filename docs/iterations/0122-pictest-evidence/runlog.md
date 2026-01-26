# Iteration 0122-pictest-evidence Run Log

规则：只记事实（FACTS）。不要写计划、不要写愿景。每个 Step 只有 PASS 才算完成。

## Environment
- OS: macOS (darwin)
- Node/Python versions: node v23.11.0, Python 3.12.7
- Key env flags: None
- Notes: Docs-only iteration

---

## Phase0 Discovery Notes (Read-Only)
- SSOT 相关条款：
  - `docs/architecture_mantanet_and_workers.md`：0.2（模型驱动/执行在工人/总线解耦）、3（ModelTable/Cell）、4（Sliding UI 仅为投影）、5（控制总线）、8.2（脚本化验收）。
- Charter 相关条款：
  - `docs/charters/dongyu_app_next_runtime.md`：3.2/3.3/3.4（Cell 固定、built-in k 以 PICtest 行为为准、PIN_IN/OUT）、6.1（仅控制总线）、7.1/7.2（PICtest 为行为 Oracle）、9（禁止事项）。
- PICtest 行为锚点（路径 + 关键符号）：
  - `vendor/PICtest/yhl/core.py`：`Cell.add_label`/`rm_label`（label_init 触发与引脚生命周期）。
  - `vendor/PICtest/yhl/labels.py`：`RunLabel.label_init`、`FunctionLabel.label_init`、`ConnectLabel.label_init`、`InLabel/OutLabel/LogInLabel/LogOutLabel.label_init`。
  - `vendor/PICtest/yhl/Connect/PIN.py`：`PIN.receive`、`PIN.save_`（消息分发、写回 Label）。
  - `vendor/PICtest/yhl/Connect/manageCell.py`：`init_pin`、`init_inner_connection`、`add_connect`。
  - `vendor/PICtest/yhl/function.py`：`Function.handle_call`、`Function.run`、pin_callout 行为。
- Out of Scope (per iteration): 运行时代码实现、UI AST/Renderer、Matrix/Element Call/E2EE、打包。

---

## Step 1 — PICtest built-in k / PIN / trigger 枚举与分类
- Start time: 2026-01-22 15:21:29 +0800
- End time: 2026-01-22 15:21:29 +0800
- Branch: dev_0122-pictest-evidence
- Commits:
  - None
- Commands executed:
  - `git checkout -b dev_0122-pictest-evidence`
  - `cat <<'EOF' > docs/iterations/0122-pictest-evidence/evidence.md ... EOF`
  - `rg -n "Enumeration" docs/iterations/0122-pictest-evidence/evidence.md`
  - `test -s docs/iterations/0122-pictest-evidence/evidence.md`
- Key outputs (snippets):
  - `Switched to a new branch 'dev_0122-pictest-evidence'`
  - `10:## Step 1 — Enumeration / 枚举与分类（仅收集与分类，不归纳）`
- Result: PASS

---

## Step 2 — 标准化行为证据表
- Start time: 2026-01-22 15:21:29 +0800
- End time: 2026-01-22 15:21:29 +0800
- Branch: dev_0122-pictest-evidence
- Commits:
  - None
- Commands executed:
  - `rg -n "Behavior Evidence Table" docs/iterations/0122-pictest-evidence/evidence.md`
  - `rg -n "Evidence Level" docs/iterations/0122-pictest-evidence/evidence.md`
- Key outputs (snippets):
  - `40:## Step 2 — Behavior Evidence Table`
  - `3:## Evidence Levels`
- Result: PASS

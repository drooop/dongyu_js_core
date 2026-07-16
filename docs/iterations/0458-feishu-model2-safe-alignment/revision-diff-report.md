---
title: "Feishu Model2 Revision 14272 Diff Evidence"
doc_type: iteration-evidence
status: active
updated: 2026-07-17
source: ai
iteration_id: 0458-feishu-model2-safe-alignment
---

# Feishu Model2 Revision 14272 Diff Evidence

## Authority Boundary

This report is factual iteration evidence, not product SSOT and not an adoption decision. Repository behavior remains governed by the current executable SSOT. F-07 and F-10 through F-14 remain `requires_user_confirmation`; this report does not authorize a Feishu write.

## Observed Source

- Source id: `feishu-model2`
- Title: `软件工人模型2`
- URL: `https://bob3y2gxxp.feishu.cn/wiki/JYNWwQOOjiWcOLktv07cBvIVnOh`
- Observed revision: `14272`
- Observed edit time: `2026-07-16 19:11:18 CST`
- Fetch transport: TLS certificate verification enabled
- Author: unknown
- Previous revision id: unknown

## Reproducible Snapshot Comparison

The old side is the committed 0454 same-format snapshot. The current side was fetched read-only to `/private/tmp/feishu-reprobe-jyn.wfMH0l/watch-state/snapshots/feishu-model2.md` and copied byte-for-byte to the ignored local evidence path `test_files/feishu_current/0458/state/snapshots/feishu-model2.md`; it is not committed as product documentation.

| Side | Path | SHA-256 | Lines | Bytes |
|---|---|---|---:|---:|
| old | `test_files/feishu_current/0454/state/snapshots/feishu-model2.md` | `6f3b1803a9d54a05452e93a2ea9c041be424196a64a3931763b1ec571b9e129a` | 4218 | 63694 |
| current | `test_files/feishu_current/0458/state/snapshots/feishu-model2.md` (ignored) | `bfca935924add0a0227daac8b630ce083a96e3bc956cabb9bfdd75cfacc1aca9` | 5075 | 74997 |

Text diff-stat: `+2269/-1412` lines (`git diff --no-index --numstat`).

Verification commands used against the two snapshots:

```bash
shasum -a 256 test_files/feishu_current/0454/state/snapshots/feishu-model2.md /private/tmp/feishu-reprobe-jyn.wfMH0l/watch-state/snapshots/feishu-model2.md
wc -l -c test_files/feishu_current/0454/state/snapshots/feishu-model2.md /private/tmp/feishu-reprobe-jyn.wfMH0l/watch-state/snapshots/feishu-model2.md
git diff --no-index --numstat test_files/feishu_current/0454/state/snapshots/feishu-model2.md /private/tmp/feishu-reprobe-jyn.wfMH0l/watch-state/snapshots/feishu-model2.md
```

## Pending Contract Findings

| ID | Class | Revision-14272 evidence | Current repository boundary |
|---|---|---|---|
| F-07 | `requires_user_confirmation` | The current source includes aggregate `config.control` and `config.manage` examples. | Current split configuration/routing behavior remains authoritative; aggregate semantics are not adopted. |
| F-10 | `requires_user_confirmation` | The current source introduces `sys_model_type`, `sys_model_size`, and `sys_` / `in_` / `out_` / `log_` / `user_` / `persis_` / `status_` key namespaces. | No namespace migration or prefix enforcement is adopted. |
| F-11 | `requires_user_confirmation` | The current source introduces program areas and lifecycle surfaces including `pin.manage`, `user_set_status`, `CLEAR_BUFFER`, `sys_func_mode`, `sys_func_order`, and `sys_match_func`. | No program-area model, MNG lifecycle, or management-pin runtime behavior is adopted. |
| F-12 | `requires_user_confirmation` | The function-label table introduces escaped forms of `func.code.python`, `func.code.js`, `func.mode`, and `func.timer.ms`. | Current `func.js` / `func.python` behavior remains authoritative; no rename or timer/mode behavior is adopted. |
| F-13 | `requires_user_confirmation` | The current source includes `log_type`, `log_info`, `log_model_id`, `log_p`, `log_r`, `log_c`, `log_func`, and `log_time`. | No new log record schema is adopted. |
| F-14 | `requires_user_confirmation` | The current source states `只有流程模型能够单独运行`. | No exclusive independent-run capability matrix is adopted. |

`sys_max_loop_time` remains a fail-closed watcher sentinel for the F-11 family, but it was not used as evidence that the term exists in this observed snapshot.

## Adoption Result

- Adopted from this report: none of F-07 or F-10 through F-14.
- Routed for later decision: F-07 and F-10 through F-14.
- Feishu mutation: none.

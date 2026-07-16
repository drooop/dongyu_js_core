---
title: "Iteration 0458 Feishu Model2 Safe Alignment Plan"
doc_type: iteration-plan
status: approved
updated: 2026-07-17
source: ai
iteration_id: 0458-feishu-model2-safe-alignment
id: 0458-feishu-model2-safe-alignment
phase: phase2
---

# Iteration 0458-feishu-model2-safe-alignment Plan

## Goal

Apply only the unambiguous safety consequences of Feishu `软件工人模型2` revision `14272`: harden the current bus-in-as-source / bus-out-as-destination contract, make the source watcher stop on newly introduced contract surfaces instead of calling them compatible, and route F-10 through F-14 as pending decisions. The bus hardening intentionally changes runtime acceptance by rejecting invalid directions; it does not adopt any disputed F-10 through F-14 semantics.

## Scope

In scope:

- Reject connection declarations that use `pin.bus.cb.in` / `pin.bus.mb.in` as a destination or `pin.bus.cb.out` / `pin.bus.mb.out` as a source, regardless of whether the route or endpoint pin is declared first.
- Preserve the legal direction: bus-in may be a source and bus-out may be a destination.
- Reject the later declaration when a route-first or endpoint-type-replacement sequence would form an invalid direction, while preserving the previously accepted label and route state.
- Keep CJS and ESM entrypoint behavior aligned and add deterministic positive/negative tests for both `pin.connect.label` and `pin.connect.cell`.
- Use stable rejection codes `bus_in_connection_destination_forbidden` and `bus_out_connection_source_forbidden`; do not store the rejected declaration or mutate its route graph, and write `pin_connection_error:json` as the ModelTable-visible failure.
- Update current runtime/PIN documentation with the same directional invariant.
- Classify watcher keyword rules only from the complete multiset of normalized added/deleted lines; use a separate exact heading protection list for lifecycle sections.
- Add exact high-risk coverage for F-07 and the F-10 through F-14 key namespaces, program lifecycle, function labels, management pin, logging schema, and independent-run claims.
- Archive a factual revision-14272 diff report and a local ignored same-format snapshot hash without treating either as product SSOT.
- Record F-10 through F-14 as `requires_user_confirmation`, strengthen F-07 evidence, add contract-routing cards, and regenerate the derived coverage summary.

Out of scope:

- Adopting `sys_/in_/out_/log_/user_/persis_/status_` key namespaces.
- Adding `pin.manage`, SYS/IN/OUT/LOG/USER/PERSIS/STATUS runtime areas, MNG lifecycle, or area APIs.
- Renaming `func.js` / `func.python`, or implementing `func.mode` / `func.timer.ms`.
- Adopting the new log schema or functional-type/independent-run matrix.
- Deciding or implementing aggregate `config.control` / `config.manage` semantics under F-07.
- Modifying `docs/ssot/feishu_alignment_decisions_v0.md` or any executable product SSOT for F-10 through F-14.
- Fixing watcher duplicate-heading identity in this iteration; repeated headings can still overwrite within the current flat section map.
- Making confirmation stops persistent across watcher runs; the current watcher still advances its operational snapshot after a stop, so the committed focused fixture and revision report remain the durable audit evidence.
- Editing Feishu, deploying remotely, merging, pushing, or opening a PR.

## Invariants / Constraints

- Current repo SSOT remains executable until a later Approved iteration adopts a disputed Feishu change.
- Direction checks use label type plus connection endpoint role; they do not depend on key naming prefixes.
- Both connection forms fail closed for route-first, pin-first, and endpoint-type-replacement orderings.
- Valid existing MBR/R1/WM1 bus chains remain unchanged.
- `confirmation_keywords` match only the complete normalized added/deleted-line multiset and preserve duplicate-line counts; `confirmation_headings` protect only the exact listed lifecycle headings. Built-in UI/bypass/compatibility rules use the same changed-line evidence.
- Report truncation must not weaken detection.
- Markdown escaping such as `func\.code\.python` and unescaped source text must classify identically.
- F-10 through F-14 are routing findings only, never `aligned`, `completed`, or `implementation_pending` in this iteration.
- F-04/F-05/F-06/F-07/F-08 retain their current classes; F-01/F-09 remain completed.
- No Feishu write is authorized. A final read-only metadata/body check may be used only to confirm the recorded revision.
- The Feishu authority model remains exactly 2 UpstreamConsensus + 4 DerivedView + 2 pending SupportingSource; only the `feishu-model2` risk-routing rules may change.
- The 21 pre-existing unstaged documentation changes are excluded and must remain untouched.
- Baseline `2aefec0` is the completed, unmerged 0457 closeout; 0458 is intentionally stacked on it and must integrate after 0454-0457.

## Frozen Watcher Risk Matrix

All values below are compared after Markdown punctuation escapes are removed. Keyword and built-in rules inspect only the full duplicate-aware added/deleted-line multiset; unchanged lines in the same section are never classification evidence.

- F-07 keywords: `config.control`, `config.manage`.
- F-10 keywords: `sys_model_type`, `sys_model_size`, `key值以sys_作为开头`, `key值以in_作为开头`, `key值以out_作为开头`, `key值以log_作为开头`, `key值以user_作为开头`, `key值以persis_作为开头`, `key值以status_作为开头`.
- F-11 keywords: `pin.manage`, `user_set_status`, `CLEAR_BUFFER`, `sys_func_mode`, `sys_func_order`, `sys_match_func`, `sys_max_loop_time`.
- F-12 keywords: `func.code.python`, `func.code.js`, `func.mode`, `func.timer.ms`.
- F-13 keywords: `log_type`, `log_info`, `log_model_id`, `log_p`, `log_r`, `log_c`, `log_func`, `log_time`.
- F-14 keyword: `只有流程模型能够单独运行`.
- Exact normalized protected headings: `func: 函数方法标签`, `6 按功能划分的模型类型`, `6.1 程序模型`, `程序模型各区标签`, `SYS区`, `IN区`, `OUT区`, `LOG区`, `USER区`, `PERSIS区`, `STATUS区`, `程序模型运行方式`, `MNG程序管理`, `启动`, `停止`, `清缓冲`, `输入缓冲`, `运行函数`, `清理`.
- Built-in changed-line-only rules: UI/side-effect terms `直接修改业务状态|UI\s*可以|UI\s*直接|绕过`; removed wiring surface `pin.connect.model`; scheduling/deprecation terms `延后|暂不实现|废弃`; compatibility term `兼容`.

Each keyword above has an independent table-driven addition/removal test. The heading list is exact rather than substring based; any content change inside an exact protected heading stops even when no keyword changes.

## Success Criteria

- Invalid endpoint directions are rejected through both CJS and ESM entrypoints for both connection declaration types, both bus families, and route-first/pin-first/type-replacement declaration order.
- Legal bus-in-source and bus-out-destination connections continue to pass existing and new regressions.
- Rejection codes are stable; rejected labels, prior endpoint labels, route graphs, and persistence remain unchanged except for the required `pin_connection_error` visible failure record.
- Existing aligned actor, model relationship, old `pin.log.*` rejection, and control/management routing tests remain GREEN.
- A representative revision-14272 fixture stops on F-07 and every F-10 through F-14 risk family, including escaped function terms, removed protected terms, duplicate-line count changes, and a risk term appearing after the 40-line report limit.
- A compatible change beside an unchanged risk term does not become a false confirmation stop; removal of a risk term remains visible.
- The revision report records revision `14272`, edit time boundary, TLS-enabled fetch, old/new hashes, `4218 -> 5075` lines, and `+2269/-1412` text diff while explicitly leaving author and old revision unknown.
- Backlog and contract index route F-10 through F-14 as `requires_user_confirmation` through four exact cards: `model.label_key_namespaces` -> F-10; `program_model.lifecycle_and_function_contract` -> F-11/F-12; `program_model.log_schema` -> F-13; `model.functional_type_capability_matrix` -> F-14. All four use `risk_level=high`.
- Watcher, runtime, contract-index, docs, syntax, and diff gates pass.
- Pre-change local images are tagged, affected images are rebuilt and restarted through a bounded OrbStack-only application path that does not run the full deploy script, all six local deployments are Ready, and the existing control/management/legacy-negative E2E plus WM1 contract pass against the rebuilt runtime.
- Three consecutive independent planning reviews approve Phase 3, and three independent closeout reviews approve the final bounded change.

## Inputs

- Created at: 2026-07-17
- Iteration ID: `0458-feishu-model2-safe-alignment`
- Branch: `dropx/dev_0458-feishu-model2-safe-alignment`
- Baseline: `2aefec0`
- Feishu source: `feishu-model2`, current observed revision `14272`

## Alternatives Considered

- Recommended: implement only direction safety, watcher fail-closed classification, and pending-decision routing. This preserves current product behavior while preventing silent adoption.
- Record-only: lower runtime risk, but leaves known invalid bus wiring executable and watcher under-detection unfixed.
- Adopt the entire revision: rejected because the source contains unresolved breaking changes and internal contradictions.

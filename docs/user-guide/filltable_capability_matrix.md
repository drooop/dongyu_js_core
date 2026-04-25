---
title: "FillTable Capability Matrix"
doc_type: user-guide
status: active
updated: 2026-04-21
source: ai
---

# FillTable Capability Matrix

这份文档固定两件事：
- 自然语言填表的能力项与测例清单
- 后续每次回归的统一执行方法

本页不是随手记录。后续所有 Prompt FillTable 实测，默认都要走这里定义的 case 和 runner；如果只测子集，也必须从这里选。

## 1. Canonical Runner

全量跑：

```bash
bash scripts/ops/run_filltable_capability_matrix_local.sh --llm-model mt-label
```

用 `mt-label-35b` 跑：

```bash
bash scripts/ops/run_filltable_capability_matrix_local.sh --llm-model mt-label-35b
```

只跑某个 scenario：

```bash
bash scripts/ops/run_filltable_capability_matrix_local.sh --llm-model mt-label --scenario leave_form_model1001_exact_mapping
```

按 tag 跑子集：

```bash
bash scripts/ops/run_filltable_capability_matrix_local.sh --llm-model mt-label --tag forms
bash scripts/ops/run_filltable_capability_matrix_local.sh --llm-model mt-label --tag structure
bash scripts/ops/run_filltable_capability_matrix_local.sh --llm-model mt-label --tag clarification
```

可选参数：
- `--scenario <id>`
- `--tag <tag>`
- `--report-file <path>`

Scenario 定义的单一事实源：`scripts/ops/filltable_capability_cases.mjs`

## 2. Execution Rules

- Runner 必须先激活 `runtime mode=running`
- 每个 scenario 都走真实链路：`llm_prompt_text -> llm_filltable_preview -> accepted/rejected -> llm_filltable_apply`
- query-only case 只允许 preview；runner 会额外 probe 一次 apply，预期必须是 `nothing_to_apply`
- parent-child / structural case 目前按默认 policy 视为 blocked scenario，不应偷偷变成成功写表
- 如果后续 policy 明确允许 structural authoring，必须先更新本页与 `scripts/ops/filltable_capability_cases.mjs`，再改代码

## 3. Capability Scenarios

| Scenario ID | Tags | Prompt Focus | Expected Result |
| --- | --- | --- | --- |
| `typed_values_model1` | `core`, `types`, `write` | 基础 `str/bool/json` 混合写入 | `title/ready/metadata` 全部命中并 apply |
| `leave_form_model1001_exact_mapping` | `forms`, `mapping`, `write` | 自由描述到请假表 schema 映射 | 必须命中 `applicant/leave_type/days/reason`；不得发明 `applicant_name` |
| `repair_form_model1002_exact_mapping` | `forms`, `mapping`, `write` | 自由描述到报修表 schema 映射 | 必须命中 `device_name/location/urgency/description`；不得发明 `title` |
| `remove_and_update_model1` | `core`, `remove`, `write` | `remove_label + set_label` 混合操作 | 删除 `metadata`，更新 `title` |
| `query_only_model1001` | `query`, `preview` | 只读查询 | preview 有 `proposal.queries`，apply probe 返回 `nothing_to_apply` |
| `parent_child_submodel_model11_blocked` | `structure`, `parent-child`, `negative` | 父子模型创建：`创建一个子模型 Model11，挂在 Model1 处` | 在默认 policy 下必须 blocked；不能创建 Model11 |
| `non_schema_field_requires_clarification` | `clarification`, `negative` | 一次沟通不够时先提问 | 对不存在的 schema 字段不应发明新 key；应保留空变更并给出问题 |

## 4. Parent-Child Coverage

当前矩阵已经覆盖父子模型诉求，但它是负例：

- `parent_child_submodel_model11_blocked`
- Prompt：`创建一个子模型 Model11，挂在 Model1 处，放在 model 1 的 (1,0,0)，名字叫 child11。`
- 当前默认 policy 不允许 structural type / submodel authoring，所以正确结果是：
  - `accepted_changes = []`
  - 不能创建 `Model11`
  - 不能改坏 `Model1`

如果将来要把“父子模型创建”升级成正例，必须同步修改：
- `packages/ui-model-demo-server/filltable_policy.mjs`
- `packages/worker-base/system-models/server_config.json`
- `scripts/ops/filltable_capability_cases.mjs`
- 本文档的 expected result

## 5. Prompt Improvement Target

这轮 Prompt 的主目标不是多写能力，而是提升 schema grounding：

- 优先已有 schema key，不要发明近义 key
- 自由描述要映射到 `p=1` schema 的 `__label` / `__props.placeholder` / `__opts`
- 枚举字段优先写 canonical option value，而不是展示文案
- 沟通不足时先问，不要硬猜

回归时必须重点看两个场景：
- `leave_form_model1001_exact_mapping`
- `repair_form_model1002_exact_mapping`

它们直接衡量“自由描述到字段的映射”是否真的变准了

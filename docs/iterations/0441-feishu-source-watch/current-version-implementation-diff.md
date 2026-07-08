---
title: "Current Feishu Version vs Implementation Diff"
doc_type: iteration-evidence
status: active
updated: 2026-07-08
source: ai
iteration_id: 0441-feishu-source-watch
id: 0441-current-version-implementation-diff
---

# 当前 Feishu 版本与现有实现差异报告

## 结论

当前两篇重点 Feishu 文档已经固定为本地 Markdown 基线，后续再次运行 watcher 可以直接发现增量变化。

本次重新阅读后的核心判断是：现有实现与 Feishu 当前版本在几个关键协议点上存在方向差异，不能由 agent 直接判定为拒绝或延后；这些项需要用户带回团队确认。已经明显是缺口但不改变方向的内容，建议进入后续 iteration 计划。

## 固定的当前版本

本次固定范围：

| id | 文档 | 本地快照 | SHA-256 |
|---|---|---|---|
| `feishu-model2` | `软件工人模型2` | `test_files/feishu_source_watch_focus_jyn_wbz/state/snapshots/feishu-model2.md` | `6f3b1803a9d54a05452e93a2ea9c041be424196a64a3931763b1ec571b9e129a` |
| `feishu-message-api` | `软件工人消息API文档` | `test_files/feishu_source_watch_focus_jyn_wbz/state/snapshots/feishu-message-api.md` | `75f96f5f3b1bff23b5cd704a0e4f0fa4ed5fff01f66fbc19cc5e7424a9c5c57e` |

基线报告：

- `test_files/feishu_source_watch_focus_jyn_wbz/report-current-baseline.md`
- 结果：`Status: NO_CHANGE`
- 检查文档数：2
- 变化文档数：0
- 确认停止项：0

说明：`test_files/` 下的快照是本地忽略目录，用于后续增量比对；当前不把完整 Feishu 私有文档内容提交到仓库。

## 官方历史版本能力

飞书 OpenAPI 的 Drive file-version 接口可读取托管版本列表和版本元数据，但本次对两篇重点文档的实测结果都是版本条目数为 0。该接口没有提供 Feishu Web UI 中“显示更改”的逐行编辑 diff。因此，当前最可靠的追踪方式仍是：

1. 用 Feishu API 拉取当前 Markdown。
2. 与本地快照做 heading 级和行级 diff。
3. 把冲突类变化标记为 `requires_user_confirmation`，等待用户和团队确认。

参考官方接口：

- `GET /open-apis/drive/v1/files/:file_token/versions`
- `GET /open-apis/docs/v1/content`

## 对照范围

Feishu 当前版本重点读取了：

- `软件工人模型2`：模型类型、模型标签、worker 标签、控制/管理总线配置、函数标签、PIN 标签、数据模型章节。
- `软件工人消息API文档`：`pin_payload.v1` 消息结构、总线引脚信息、payload 子模型表、资源/数据/UI/任务/worker 消息 API。

仓库对照依据：

- `docs/ssot/label_type_registry.md`
- `docs/ssot/runtime_semantics_modeltable_driven.md`
- `docs/ssot/temporary_modeltable_payload_v1.md`
- `docs/ssot/pin_connection_contract_v2.md`
- `docs/ssot/feishu_model_label_alignment_v1.md`
- `packages/worker-base/src/runtime.mjs`
- `scripts/tests/test_0432_subtable_connection_runtime_contract.mjs`
- `scripts/tests/test_0348_feishu_data_model_contract.mjs`

## 需要用户和团队确认

这些不是 agent 可以直接拒绝或改掉的内容，因为 Feishu 文档代表会议共识；但它们与当前实现方向冲突或会破坏现有约束，必须先确认目标口径。

| 项 | Feishu 当前版本 | 现有实现 | 不能直接处理的原因 | 建议下一步 |
|---|---|---|---|---|
| 消息协议版本 | `软件工人消息API文档` 明确当前版本为 `pin_payload.v1`，示例也写 `__mt_payload_kind = pin_payload.v1`。 | 仓库正式 bus / pin transport 是 `pin_payload.v2`，运行时会拒绝 `pin_payload.v1`，拒绝码为 `legacy_pin_payload_kind_removed`。 | 直接改回 v1 会破坏 0430 之后的 `topic` / `response_topic` / `payload_model_id` / table-qualified 回包合同。 | 确认 Feishu 文档是否应升级到 v2，或是否需要另开兼容转换层 iteration。 |
| 主模型表类型 | `软件工人模型2` 使用 `model.v1n` 表示主模型表。 | 当前注册表和运行时使用 `model.table` 加 `sys_worker_role` / `sys_worker_id`；`model.v1n` 会被运行时拒绝。 | 这是命名和输入面的根合同差异，不应由 agent 擅自把会议文档改写为实现口径。 | 确认 `model.v1n` 是产品术语，还是要成为合法 `label.t`。 |
| 子模型表连接值 | Feishu 示例中 `model.subtableconnection.v` 是数字，例如 `1` 或 `2`。 | 当前实现要求 object：`{ table_id, root_model_id, mount_kind, owner_principal_id? }`。 | 直接接受数字会丢失 table / principal 边界，影响滑动 App、多用户隔离和 child table namespace。 | 确认 Feishu 文档是否补充 table-qualified 写法，或是否需要文档到实现的映射层。 |
| payload 表达方式 | Feishu 把消息 payload 放在子模型表 `0.1`，父消息 Cell 用 `model.subtableconnection` 连接。 | 当前 v2 要求业务 records 与 metadata 在同一个 Temporary ModelTable record array 中，通过 `payload_model_id` 指向业务模型。 | 这是消息结构差异，不只是字段名差异；直接改实现会影响 MBR、MQTT、UI 回包路径。 | 确认是否保留 Feishu 的子模型表表达作为概念层，同时在传输层映射到 v2。 |
| 总线配置标签 | Feishu 有 `config.control` / `config.manage` 标签。 | 当前实现更多使用拆分 bus pins、worker identity、endpoint / topic metadata；未把这两个标签注册成正式运行输入面。 | 这涉及配置真源放在哪里，可能影响启动配置、运行时路由和权限。 | 确认这两个标签是文档概念说明，还是需要注册为新的 SSOT label 类型。 |

## 可以进入后续计划的实现缺口

这些更像是当前实现尚未覆盖 Feishu 当前版本的能力；只要上面的方向性问题确认后，可以拆成独立 iteration。

| 项 | Feishu 当前版本 | 当前实现状态 | 计划建议 |
|---|---|---|---|
| `model.matrix.size` | Feishu 明确用 `model_size` / `model.matrix.size` 表示矩阵范围。 | 当前注册表和运行时尚未把它作为完整结构标签闭环实现。 | 建议开一个矩阵范围验证 iteration，包含范围冲突、越界、嵌套规则。 |
| 资源消息 API | Feishu 定义 `resource.report` / `resource.request` / `resource.result`。 | 当前仓库没有这些 `sys_msg_type` 的正式处理链路。 | 在消息协议口径确认后，作为资源管理器消息合同落地。 |
| 数据消息 API | Feishu 定义 `data.save_modeltable` / `data.load_modeltable` / `data.save_flow` / `data.load_flow`。 | 当前仓库已有 Temporary ModelTable 与 materialization 边界，但没有按这些 `sys_msg_type` 做 DAM 语义闭环。 | 拆成 DAM save/load 和 Flow save/load 两个较小 iteration。 |
| UI 消息 API | Feishu 定义 `ui.update_data` / `ui.tmp_data` / `ui.form_data` / `ui.refresh_data`。 | 当前 UI 已有滑动 App、事件和回包路径，但没有直接以这些 `sys_msg_type` 作为公开 API。 | 在 v2 映射确认后，对齐 UI 输入/刷新消息合同。 |
| 任务管理器消息 API | Feishu 定义 `task_data` 以及 `add_task` / `edit_task` / `delete_task` / `receive_task` / `finish_task` / `archive_task` 等引脚。 | 当前仓库有 To Do / task 相关实现线索，但没有这套消息 API 的完整合同和测试。 | 单独建 task manager message iteration，不与底层协议迁移混在一起。 |
| 数据模型族 | Feishu 仍使用 `Data.Array`，并列出 Queue / Stack / CircularBuffer / LinkedList / FlowTicket 等。 | 当前合同已将 `Data.Array` 拆成 `Data.Array.One/Two/Three`，已实现重点偏 `Data.Single` / `Data.Array.One`，其余仍是 debt。 | 按 `feishu_data_model_contract_v1.md` 的 debt 顺序推进，不恢复旧别名。 |

## 已经对齐或基本可复用

这些内容与当前仓库方向一致，后续不需要回会议确认，除非 Feishu 文档又发生新变化。

| 项 | 对齐情况 |
|---|---|
| 基础 `k/t/v` 标签记录形态 | Feishu 与当前 ModelTable record 形态一致。 |
| `sys_worker_role` / `sys_worker_id` | Feishu 当前文档与注册表一致，当前实现也有位置和值校验。 |
| `model.single` / `model.matrix` / `model.subtable` / `model.submt` / connection 系列 | 名称大体一致；差异主要集中在 `model.v1n` 和 `model.subtableconnection.v` 形状。 |
| 控制总线 / 管理总线 split pins | Feishu 已列出 `pin.bus.cb.*` 和 `pin.bus.mb.*`，当前实现也是 split bus。 |
| `pin.log.*` 退场 | Feishu 文档中 `pin.log.in/out` 已做删除线，并指向 `pin.login` / `pin.logout`；当前实现也拒绝 `pin.log.*`。 |
| 函数标签 value 结构 | Feishu 示例使用 `{ "code": "..." }`，当前实现也优先读取结构化 `code`。 |
| side effect 入口 | Feishu 模型操作以 `add_label` / 删除标签为核心；当前实现也把正式副作用限制在 label 写入/删除路径。 |
| 子侧声明和父侧连接的基本拆分 | Feishu 已区分 `model.subtable` / `model.subtableconnection`、`model.submt` / `model.submtconnection`；当前实现保留这个方向，并加强 table-qualified 边界。 |

## 建议的下一步

1. 先把“需要用户和团队确认”的 5 项带回确认，不在当前 iteration 内直接改实现。
2. 如果团队确认仓库的 v2 / table-qualified 方向仍是目标，应更新 Feishu 对齐文档，明确 Feishu 概念写法到实现输入面的映射。
3. 如果团队确认 Feishu 当前写法就是目标输入面，应新开协议回迁或兼容层 iteration，先写破坏面评估，再动运行时。
4. 已列出的实现缺口按小 iteration 推进，尤其不要把 `sys_msg_type` API、数据模型族和底层消息协议揉成一次大改。
5. 后续每次 Feishu 文档更新，继续使用当前 state dir 生成增量报告；冲突类变化保持 `requires_user_confirmation`。

## 验证命令

本报告生成前后的验证标准：

```bash
node scripts/tests/test_0441_feishu_source_watch_contract.mjs
node --check scripts/ops/feishu_source_watch.mjs
node --check scripts/tests/test_0441_feishu_source_watch_contract.mjs
git diff --check
node scripts/ops/validate_obsidian_docs_gate.mjs
```

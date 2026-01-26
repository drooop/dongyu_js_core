# ModelTable Runtime Spec v0
本 Spec 是 Stage 2.x 期间 ModelTable Runtime 的唯一接口与语义约束；任何实现不得偏离，除非同步更新 Harness 与证据。

## 1) Cell Identity & Model Structure
- Cell 唯一身份由 `(p, r, c)` 组成；`p/r/c` 必须为整数。
- 澄清：`k` 属于 **label 维度**，不属于 cell identity；Cell(p,r,c) 内含多个 label(k/t/v)，与 PICtest 的 `add_label` 模型一致。
- ModelTable 的最小维度为 `Model -> Cells[(p,r,c)] -> Labels[k]`。

## 2) Core API (v0 Interface Surface)
- `create_cell(p, r, c) -> Cell`
  - 若 Cell 已存在则返回既有实例。
- `get_cell(p, r, c) -> Cell`
  - 若不存在则创建（PICtest 对齐；证据见 `docs/iterations/0122-pictest-evidence/evidence.md`）。
- `add_label(cell, label, save=true, init=true) -> void`
  - 负责校验、覆盖/合并、触发 label_init。
- `rm_label(cell, k, save=true) -> void`
  - 移除 label，并触发引脚移除逻辑（与 PICtest 行为对齐）。
- `set_labels(cell, labels[], save=true, init=true) -> void`
  - 批量替换 label 集合；必须生成一致的变更事件序列。
- `list_cells() -> Cell[]`
  - 用于 Harness 对照抽样与快照。
- `snapshot() -> ModelTableSnapshot`
  - 输出确定性快照（用于对照测试）。

## 3) Validation Rules
- `p/r/c` 必须为整数；否则拒绝写入并记录错误事件。
- `label.k` 必须为非空字符串；否则拒绝写入并记录错误事件。
- `label.t` 必须为非空字符串；否则拒绝写入并记录错误事件。
- `label.v` 可为任意 JSON 可序列化值；不可序列化时记录错误事件。

## 4) Deterministic Update Semantics
- **写入顺序**：同一批操作按调用顺序入队执行；每次写入生成严格递增的 `event_id`。
- **覆盖/合并**：同一 Cell 的同名 `label.k` 采用**覆盖**语义（以最后写入为准）；无隐式合并。
- **t/v 变更规则**：若 `label.k` 已存在且 `t` 或 `v` 变化，则视为一次覆盖更新；必须产生更新事件并记录旧值与新值。
- **时间处理**：事件时间戳由运行时单调递增计数 + 可选 wall-clock 记录；对照测试以 `event_id` 为主序。
- **随机处理**：v0 不允许引入随机性；若发现随机源必须记录并阻断。

---

# EventLog / ChangeLog + Persistence Contract v0

## 5) EventLog / ChangeLog

### Minimal EventLog Fields
- `event_id`（递增）
- `ts`（可选 wall-clock）
- `op`（add_label / rm_label / set_labels / error）
- `cell`（p/r/c）
- `label`（k/t/v）
- `prev_label`（可选，覆盖/移除时）
- `result`（applied / rejected）
- `reason`（可选，错误原因）
- `trace_id`（可选，用于跨操作关联）

### Granularity
- 以 **Label-level** 记录（每次 label 变更 = 1 event）。选择理由：PICtest 原子操作与 Harness 覆盖索引均以 `label.k` 为核心。
- 批量操作 `set_labels` 必须拆解为可审计的逐 label 事件序列。

### Harness 对比口径
- Harness 以 `event_id` 顺序比对 EventLog；ModelTable 快照用于终态校验。
- Concrete Key Coverage Matrix 中每个 key 的“期望副作用”必须可映射为 EventLog 事件序列。

## 6) Persistence Contract v0
- v0 允许内存实现，但必须定义持久化接口契约：
  - `load(checkpoint_id?) -> ModelTableSnapshot`
  - `flush(snapshot) -> checkpoint_id`
  - `checkpoint(reason) -> checkpoint_id`
- 所有持久化接口必须可被 Harness stub/mock 以验证行为顺序与快照一致性。

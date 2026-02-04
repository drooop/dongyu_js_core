# 定位说明（必须写在文件开头）

本文件是 mt.v0 Patch 操作规范（mt.v0 Patch Operations Spec）。

上位约束：`docs/architecture_mantanet_and_workers.md`

关联规范：`docs/ssot/runtime_semantics_modeltable_driven.md`

作用对象：所有通过 Patch 机制修改 ModelTable 的组件（MBR、Remote Worker、applyPatch 调用方）

目的：统一定义 mt.v0 版本 Patch 的结构与操作语义

---

# mt.v0 Patch Operations Specification

## 0. Scope & Intent

本规范定义 mt.v0 版本的 Patch 结构和支持的操作类型。

Patch 是 ModelTable 状态变更的批量载体，用于：
- 管理总线 → 控制总线的指令传递（MBR 翻译 ui_event → patch）
- 控制总线上的状态同步（Remote Worker 应用 patch 并回传 ACK）
- 跨组件的 ModelTable 状态复制

---

## 1. Patch 结构

### 1.1 基本格式

```json
{
  "version": "mt.v0",
  "op_id": "<unique_operation_id>",
  "records": [
    { "op": "<operation_type>", ... }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `version` | string | 是 | 固定值 `"mt.v0"` |
| `op_id` | string | 是 | 操作唯一标识，用于去重和追踪 |
| `records` | array | 是 | 操作记录数组，按顺序执行 |

### 1.2 幂等性

- 同一 `op_id` 的 Patch 可能被多次接收（网络重传、MBR 重播）
- 接收方应实现去重（基于 `op_id` 的 seen set）
- `create_model` 对已存在的 model 视为成功（幂等）

---

## 2. 支持的操作类型

### 2.1 add_label

向指定 Cell 添加或更新 Label。

```json
{
  "op": "add_label",
  "model_id": 1,
  "p": 0,
  "r": 0,
  "c": 0,
  "k": "title",
  "t": "str",
  "v": "Hello"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `op` | string | 是 | 固定值 `"add_label"` |
| `model_id` | int | 是 | 目标模型 ID |
| `p`, `r`, `c` | int | 是 | Cell 坐标（position, row, column） |
| `k` | string | 是 | Label key |
| `t` | string | 是 | Label type |
| `v` | any | 是 | Label value（必须 JSON 可序列化） |

### 2.2 rm_label

从指定 Cell 移除 Label。

```json
{
  "op": "rm_label",
  "model_id": 1,
  "p": 0,
  "r": 0,
  "c": 0,
  "k": "title"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `op` | string | 是 | 固定值 `"rm_label"` |
| `model_id` | int | 是 | 目标模型 ID |
| `p`, `r`, `c` | int | 是 | Cell 坐标 |
| `k` | string | 是 | 要移除的 Label key |

### 2.3 create_model

创建新模型。

```json
{
  "op": "create_model",
  "model_id": 3,
  "name": "MyModel",
  "type": "data"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `op` | string | 是 | 固定值 `"create_model"` |
| `model_id` | int | 是 | 新模型 ID（不能为 0） |
| `name` | string | 是 | 模型名称（非空） |
| `type` | string | 是 | 模型类型（非空，如 `"data"`, `"system"`） |

**约束：**
- 需要 `allowCreateModel: true` 选项
- `model_id = 0` 被拒绝（根模型不可创建）
- 若模型已存在，视为成功（幂等）

### 2.4 cell_clear

清除指定 Cell 中的可清除 Labels。

```json
{
  "op": "cell_clear",
  "model_id": 3,
  "p": 0,
  "r": 0,
  "c": 0
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `op` | string | 是 | 固定值 `"cell_clear"` |
| `model_id` | int | 是 | 目标模型 ID |
| `p`, `r`, `c` | int | 是 | Cell 坐标 |

**约束：**
- 模型必须已存在（不会自动创建）
- 只清除符合 clearable 规则的 Labels（见第 3 节）

---

## 3. cell_clear 保护规则

`cell_clear` 操作不会清除所有 Labels，只清除符合以下条件的 Labels：

### 3.1 可清除条件（全部满足）

1. **类型允许**：`t` 必须是 `str`, `int`, `bool`, `json` 之一
2. **非保留 key**：`k` 不在保留列表中
3. **非禁止 key**：`k` 不匹配禁止模式

### 3.2 保留 Labels（RESERVED_CLEAR_LABELS）

以下 `k` 永不被清除：

| k | 用途 |
|---|------|
| `ui_event` | UI 事件 mailbox |
| `ui_event_error` | UI 事件错误 |
| `ui_event_last_op_id` | 最后处理的 op_id（去重用） |

### 3.3 禁止模式（matchForbiddenK）

以下 `k` 匹配禁止模式，不会被清除：

| 模式 | 示例 | 用途 |
|------|------|------|
| `pin_in` / `pin_out` | - | PIN 声明 |
| `v1n_id` / `data_type` | - | 系统标识 |
| `run_*` | `run_submit` | 函数触发 |
| `mqtt_*` | `mqtt_target_host` | MQTT 配置 |
| `matrix_*` | `matrix_room_id` | Matrix 配置 |
| `CONNECT_*` | `CONNECT_timeout` | 连接配置 |
| `*_CONNECT` | `CELL_CONNECT`, `MODEL_CONNECT` | 连接声明 |

### 3.4 规则一致性

`cell_clear` 在以下两处实现，规则必须保持一致：

| 位置 | 函数 | 用途 |
|------|------|------|
| `packages/worker-base/src/runtime.js` | `clearableLabel()` in `applyPatch()` | 远程 Patch 应用 |
| `packages/ui-model-demo-frontend/src/local_bus_adapter.js` | `editableLabel()` | 本地 UI 事件处理 |

---

## 4. applyPatch 选项

```javascript
runtime.applyPatch(patch, options);
```

| 选项 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `allowCreateModel` | boolean | `false` | 是否允许 `create_model` 操作 |

**安全考虑：**
- 默认不允许创建模型，防止未授权的模型注入
- 仅在受信任的场景（如 Remote Worker 处理已验证的 Patch）启用

---

## 5. 返回值

```javascript
const result = runtime.applyPatch(patch, options);
// { applied: number, rejected: number, reason?: string }
```

| 字段 | 说明 |
|------|------|
| `applied` | 成功应用的记录数 |
| `rejected` | 被拒绝的记录数 |
| `reason` | 若整个 patch 无效，说明原因（如 `"invalid_patch"`） |

---

## 6. 使用示例

### 6.1 MBR 翻译 ui_event → patch

```javascript
// submodel_create action
if (action === 'submodel_create') {
  patch = {
    version: 'mt.v0',
    op_id: opId,
    records: [{
      op: 'create_model',
      model_id: value.v.id,
      name: value.v.name,
      type: value.v.type
    }]
  };
}

// cell_clear action
if (action === 'cell_clear') {
  patch = {
    version: 'mt.v0',
    op_id: opId,
    records: [{
      op: 'cell_clear',
      model_id: target.model_id,
      p: target.p,
      r: target.r,
      c: target.c
    }]
  };
}
```

### 6.2 Remote Worker 应用 patch

```javascript
// 启用 allowCreateModel 以支持 create_model 操作
runtime.applyPatch(patch, { allowCreateModel: true });
```

---

## 7. 版本演进

| 版本 | 状态 | 说明 |
|------|------|------|
| mt.v0 | 当前 | 基础操作：add_label, rm_label, create_model, cell_clear |
| mt.v1 | 规划中 | 可能增加：batch_update, model_clone, cell_move |

---

## 8. 相关文件

| 文件 | 说明 |
|------|------|
| `packages/worker-base/src/runtime.js` | `applyPatch()` 实现 |
| `packages/worker-base/src/runtime.mjs` | ESM 版本 |
| `scripts/run_worker_mbr_v0.mjs` | MBR 翻译 ui_event → patch |
| `scripts/run_worker_remote_v0.mjs` | Remote Worker 应用 patch |
| `scripts/validate_dual_worker_slide_e2e_mailbox_ops_v0.mjs` | 端到端验证 |

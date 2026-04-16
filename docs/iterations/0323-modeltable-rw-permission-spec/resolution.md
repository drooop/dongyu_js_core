---
title: "0323 — Resolution: 文档修改步骤"
doc_type: iteration-resolution
status: completed
created: 2026-04-17
updated: 2026-04-17
source: ai
---

# 0323 — Resolution

## Step 1: 修改 `docs/ssot/host_ctx_api.md`

全面改写 ctx API 为 V1N 命名空间：

**§1 数据访问** 替换为：

| API | 签名 | 作用域 | 说明 |
|---|---|---|---|
| `V1N.addLabel` | `(k, t, v)` | 仅当前 Cell | 替代 ctx.writeLabel，无坐标参数 |
| `V1N.removeLabel` | `(k)` | 仅当前 Cell | 替代 ctx.rmLabel，无坐标参数 |
| `V1N.readLabel` | `(p, r, c, k)` | 当前模型内任意 Cell | 替代 ctx.getLabel，限制 model_id 为当前模型 |

**新增约束：**
- 跨 Cell 写入：必须通过 pin 路由到 (0,0,0) 的 `mt_write:in`
- 跨模型通信：必须通过 pin 链路经 Model 0 路由
- 跨模型读取：必须通过 pin 请求-响应模式

**Deprecation：**
- `ctx.writeLabel`、`ctx.getLabel`、`ctx.rmLabel` 标注为 DEPRECATED
- 兼容期：直到后续实现迭代正式移除

**验证：** 文档内容自洽，无引用悬空。

---

## Step 2: 修改 `docs/ssot/runtime_semantics_modeltable_driven.md`

**§5.3 模型形态约束** 在 `model.table` 条目下增加：

> model.table (0,0,0) 必须包含以下三个默认 func.js 标签作为基础设施程序：
>
> | func.js key | 引脚 | 职责 | 权限 |
> |---|---|---|---|
> | `mt_write` | `mt_write:in` / `mt_write:out` | 接收写入请求，对当前 model.table 内任意 Cell 执行 addLabel/rmLabel | 模型内特权 |
> | `mt_bus_receive` | `mt_bus_receive:in` / `mt_bus_receive:out` | 接收从父模型路由下来的消息，分发到模型内目标 Cell | 模型内特权 |
> | `mt_bus_send` | `mt_bus_send:in` / `mt_bus_send:out` | 汇集模型内 Cell 的外发消息，上行到父模型边界 | 模型内特权 |
>
> 这三个程序替代原 (0,1,0) helper executor 模式。用户程序不得覆盖或删除。

**新增 §5.x 运行时权限模型：**

> ### 5.x 运行时权限模型（0323）
>
> **权限分层：**
> - (0,0,0) 默认三程序：模型内特权（可读写当前模型任意 Cell）
> - 用户自定义程序：沙箱权限（写仅限自身 Cell，读仅限当前模型）
>
> **V1N API 面（暴露给用户程序）：**
> - `V1N.addLabel(k, t, v)` — 仅当前 Cell
> - `V1N.removeLabel(k)` — 仅当前 Cell
> - `V1N.readLabel(p, r, c, k)` — 当前模型内任意 Cell（只读）
>
> **跨 Cell 写入路径：**
> 用户程序 pin.out → pin.connect.label/cell → (0,0,0) mt_write:in → mt_write 执行写入
>
> **跨模型通信路径：**
> 1. 子模型挂载路径：model.submt hosting cell → 引脚接出/接入
> 2. Model 0 中转路径：Cell pin.out → (0,0,0) mt_bus_send:in → 模型边界 pin.out → Model 0 pin.connect.model → 目标模型
>
> **禁止：**
> - 用户程序直接读写其他模型的 Cell
> - 用户程序绕过 pin 链路的任何直接跨模型操作

**验证：** 文档内容与 host_ctx_api.md 一致。

---

## Step 3: 修改 `docs/architecture_mantanet_and_workers.md`

**§3.4 Model Forms** 在 model.table 段落后增加 (0,0,0) 默认基础设施说明。

**§6 PIN 系统架构** 增加权限模型概要引用（指向 runtime_semantics 的详细定义）。

**验证：** 与上位约束一致。

---

## Step 4: 修改 `CLAUDE.md`

**MODEL_FORMS 节** model.table 条目增加默认三程序说明。

**FUNCTION_LABELS 节** 增加 (0,0,0) 默认基础设施 func.js 的保留 key 列表。

**新增 PERMISSION_MODEL 节：**
- V1N API 面定义
- 写权限：仅自身 Cell
- 读权限：当前模型内
- 跨 Cell 写入：经 (0,0,0) mt_write
- 跨模型通信：经 pin 链路

**DEPRECATED 更新：**
- helper executor (0,1,0) 标注为 DEPRECATED（被 (0,0,0) 三程序替代）
- ctx.writeLabel / ctx.getLabel / ctx.rmLabel 标注为 DEPRECATED（被 V1N API 替代）

**验证：** CLAUDE.md 自洽，与下层 SSOT 一致。

---

## Step 5: 创建 runlog.md 骨架

记录每步执行状态。

**验证：** 所有 Step 均有 PASS/FAIL 记录。

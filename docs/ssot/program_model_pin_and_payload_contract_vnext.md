---
title: "Program Model Pin And Payload Contract vNext"
doc_type: ssot
status: active
updated: 2026-04-27
source: ai
---

# Program Model Pin And Payload Contract vNext

## Purpose

本文档冻结一组新的目标合同，作为后续基础迁移与业务线实现的共同前置：

1. 引脚归属程序模型  
2. 数据 payload = 临时模型表  
3. 不引入 `pin.table.*`

说明：
- 这是目标合同。
- 当前仓库运行时尚未完全实现它。
- `foundation B` 负责把现有实现迁到本合同。

## 1. Pin Ownership

### 1.1 Core Rule

模型引脚本质上都是程序模型的引脚。  
引脚不再被理解为“裸 Cell 自己拥有的输入/输出口”。

### 1.2 Implicit Program Model

即使一个 Cell 没有显式声明 `func.js` / `func.python`，也视为存在可接线的默认程序模型语义。

当用户在该 Cell 上声明 `pin.in` / `pin.out` 时：

- 可以不额外显式声明程序模型
- 该 pin 视为一个默认程序模型端点

### 1.3 Multiple Pins

当一个 Cell 上声明多个 pin 时：

- 该 Cell 可以同时承载多个默认程序模型端点
- 每个 pin 名称对应一个默认程序模型端点
- 这不是“一个 Cell 只能有一个默认程序模型”
- 也不是“必须额外声明多个 `func.js` label”
- 只要定义了多个 pin，就等于定义了多个默认程序模型端点

### 1.4 Explicit Program Model

当用户显式声明自定义程序模型时：

- 系统应自动为该程序模型建立 `In` / `Out` 端点语义
- 仍然必须声明 pin label，才能把参数接进来、才能触发该程序
- “无 pin label 的程序模型不可被外部合法触发”

## 2. Default Behavior

默认程序模型的最小行为冻结如下：

- 当某个默认程序模型端点的 `In` 被触发时：
  - 默认行为是把输入值原封不动写入对应 `In` label 的 `v`
- 当目标 Cell 原本是空格子，但用户要把值接入该 Cell 时：
  - 系统应自动在该 Cell 上创建对应的 `In` label
- 真正的增删改查语义，不由 payload 内的 `action` 决定
- 真正的动作语义由“接收到的 pin 名称 + 接收程序模型”决定

换句话说：

- 数据只负责携带“是什么”
- pin / 程序模型负责决定“拿它做什么”

## 3. Payload Rule

### 3.1 Core Rule

数据引脚上传递的是“临时模型表”，而不是带 `action` 的 envelope。

权威数据定义：
- [[docs/ssot/temporary_modeltable_payload_v1]]

0331 收紧：
- 所有正式业务 pin 的非空 value 都必须是临时 ModelTable record array。
- 旧式 `{ op, records }` 对象只能作为历史迁移债务，不得作为新通过路径。
- 外层 transport 可以继续有 packet/envelope，但 packet 的业务 `payload` 字段必须是临时 ModelTable record array。

0347 冻结：
- pin/event 中传递的是 Temporary ModelTable Message：`format is ModelTable-like; persistence is explicit materialization`。
- 临时 message 的 `{id,p,r,c,k,t,v}` shape 只说明它能按 ModelTable 结构表达数据，不说明它已经被写入正式模型表。
- `id` 是 message-local 临时 id，不是正式 `model_id`。
- 接收方只有在自身 pin/program 语义明确要求并通过 owner / D0 / importer materialization 路径时，才能把 message 写成正式 label。
- 单纯收到 pin value、转发 bus payload、保存诊断 trace 或推送前端 projection，都不得自动 materialize。

### 3.2 Action Removal

payload 中不再体现：

- `action`
- `op`
- 任何“这是 add / delete / update”的直接动作字段

这些动作由接收程序模型自身的 pin 语义承担，例如：

- `add_data:in`
- `delete_data:in`
- `update_data:in`
- `find_by_id:in`

## 4. Pin Type Rule

### 4.1 Target Contract

本合同冻结：

- 不保留 `pin.model.in`
- 不保留 `pin.model.out`
- 不引入 `pin.table.in`
- 不引入 `pin.table.out`
- 不引入 `pin.single.in`
- 不引入 `pin.single.out`

模型本地程序/数据入口统一收敛到：

- `pin.in`
- `pin.out`
- `pin.bus.*` 继续仅保留为系统边界

### 4.2 Compatibility Note

当前仓库里仍然存在大量 `pin.table.*` / `pin.single.*` / `pin.log.table.*` / `pin.log.single.*` 历史写法。  
这些属于 `foundation B` 的迁移目标，不代表本合同继续认可它们。

### 4.3 System Boundary Note

本合同当前只冻结模型本地程序/数据引脚。  
`pin.bus.*` 是否继续保留为系统边界 family，不在本次 docs-only 冻结中展开重写。

## 5. D0 And Matrix Authority Rule

### 5.1 D0 Definition

本文中的 D0 指：

- `p = 0`
- `r = 0`
- `c = 0`

也就是某个 `model.table` 中坐标全为 0 的那个格子。

### 5.2 model.table Authority

- 如果程序模型位于 `model.table` 的 D0：
  - 它可以读写该 table 下所有单元格的标签
- 如果程序模型位于非 D0 单元格：
  - 它只能修改自己所在单元格里的内容
  - 不因为它属于这个 table，就天然拥有 table 其他格子的写权限

### 5.3 Matrix Rule

- 矩阵模型仍然处在同一个 `model.table` 内
- 矩阵的 D0 可以管理该矩阵范围内的单元格（包括子矩阵）
- 同时，所属 `model.table` 的 D0 也仍然可以管理这个矩阵区域
- 这不视为越权，因为它们仍在同一个 `model.table` 内

### 5.4 Child Model Rule

- 子模型本质上是另一张模型表
- 父子之间只能通过 pin 连接接入数据
- 由于父子已通过不同 `model_id` 与 pin 连接天然分层，因此这里不再额外引入“子模型边界检查”概念

## 6. What This Changes

与当前仓库主线相比，这份合同的变化是：

- pin 语义从“Cell 级 / model 级 / table 级 / single 级分化”收敛到“程序模型端点”
- payload 从“动作 + 数据混合体”收敛到“纯临时模型表”
- 增删改查由接收程序模型决定，而不是由 payload 决定
- `writeLabel` 不再是任意对象写请求；它是一个用户 API，底层生成 `write_label.v1` 临时模型表 payload，并通过显式 pin 路由到当前模型 D0。

### 6.1 writeLabel Program Endpoint Rule (0331)

用户程序调用 `writeLabel` 时，只表达自己想写入的目标 cell 和 label：

```js
V1N.writeLabel(2, 2, 2, { k: 'testk', t: 'testtype', v: 'testv' })
```

运行时/模板层负责生成临时 ModelTable payload，并把它写入当前 cell 的显式 write pin。

推荐默认 pin 名称：
- 当前 cell 输出：`write_label_req`
- 当前模型 D0 输入：`mt_write_req`

推荐显式路由：
```json
[
  { "from": [1, 1, 1, "write_label_req"], "to": [[0, 0, 0, "mt_write_req"]] }
]
```

D0 的 `mt_write` 只解释 `write_label.v1` payload：
- 根据 `__mt_target_cell` 找到目标 cell。
- 从 payload 中取唯一一个非 `__mt_*` 用户 label。
- 执行实际 `addLabel`。
- 如果用户 label 数量不是 1，必须 reject。

这保留显式 pin 可审计性，同时不要求普通用户手写 `__mt_*` 过程字段。

## 7. What This Does Not Change

本合同当前不直接定义：

- `MBR` 新协议
- bus 拓扑重排
- Matrix / Slide UI / Three.js 的具体业务模型
- 数据模型与流程模型的最终实现细节

这些都在后续迭代中建立在本合同之上。

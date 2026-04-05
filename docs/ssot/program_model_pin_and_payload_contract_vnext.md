---
title: "Program Model Pin And Payload Contract vNext"
doc_type: ssot
status: active
updated: 2026-04-06
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

- 每个 pin 名称对应一个独立的默认程序模型端点语义
- 不要求用户为这些端点逐一写出显式程序模型 label

### 1.4 Explicit Program Model

当用户显式声明自定义程序模型时：

- 仍然必须声明 pin label，才能把参数接进来、才能触发该程序
- “无 pin label 的程序模型不可被外部合法触发”

## 2. Default Behavior

默认程序模型的最小行为冻结如下：

- 接收到 `pin.in` 数据后，默认程序模型可以把该输入视为“当前 Cell / 当前模型上下文中的输入值”
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

- 不引入 `pin.table.in`
- 不引入 `pin.table.out`

模型本地程序/数据入口统一收敛到：

- `pin.in`
- `pin.out`

### 4.2 Compatibility Note

当前仓库里仍然存在大量 `pin.table.*` / `pin.single.*` / `pin.log.table.*` / `pin.log.single.*` 历史写法。  
这些属于 `foundation B` 的迁移目标，不代表本合同继续认可它们。

### 4.3 System Boundary Note

本合同当前只冻结模型本地程序/数据引脚。  
`pin.bus.*` 是否继续保留为系统边界 family，不在本次 docs-only 冻结中展开重写。

## 5. What This Changes

与当前仓库主线相比，这份合同的变化是：

- pin 语义从“Cell 级 / table 级 / single 级分化”收敛到“程序模型端点”
- payload 从“动作 + 数据混合体”收敛到“纯临时模型表”
- 增删改查由接收程序模型决定，而不是由 payload 决定

## 6. What This Does Not Change

本合同当前不直接定义：

- `MBR` 新协议
- bus 拓扑重排
- Matrix / Slide UI / Three.js 的具体业务模型
- 数据模型与流程模型的最终实现细节

这些都在后续迭代中建立在本合同之上。

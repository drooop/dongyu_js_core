---
title: "Imported Slide App Host Ingress Semantics v1"
doc_type: ssot
status: active
updated: 2026-04-14
source: ai
---

# Imported Slide App Host Ingress Semantics v1

## 0. Status

这是一份 **候选正式架构规约**。

它的作用是冻结 imported slide app 后续应收敛到的宿主接入语义。

它 **不是** 当前 live code 的事实描述。  
当前 live code 的事实，仍以：

- `0305`
- `0306`
- `0310`
- `0311`
- `docs/ssot/runtime_semantics_modeltable_driven.md`

为准。

当前实现里，前端 pin 事件仍可直达目标 cell 的目标 pin；本页定义的是后续 imported app 应收敛到的 **宿主正式 ingress** 语义。

## 1. 为什么需要这份规约

当前仓库已经冻结了这些事实：

- 前端正式协议是：
  - `target = cell`
  - `pin = port`
- 输入草稿和延后提交已经成立
- cell 的有效模型标签唯一，但可被多层 scope 发现
- 真正执行靠 pin 链和目标坐标，而不是靠“显式多重归属”

但 imported app 仍缺一层正式裁决：

- 宿主怎样把外来的正式业务输入交给 imported app
- 宿主在安装时自动补哪些 adapter
- imported app 最少要暴露哪些边界 pin，宿主才知道怎么接

本页只裁决这 3 件事。

## 2. 当前事实与候选规约的分界

### 2.1 当前事实

- 前端 pin 事件可以直接写目标模型、目标单元格、目标 pin。
- 并不是所有正式事件都已经统一先进 `Model 0`。
- imported app 导入后，可以自己定义内部 pin 链、helper、root relay。
- 输入草稿、本地 overlay、on_blur / on_submit 延后同步已经成立。

### 2.2 候选规约

对 imported slide app 来说，后续正式收敛方向应是：

- imported app 保留自己的内部程序模型和内部 pin 链
- 宿主在安装时自动补一层“宿主接入 adapter”
- 所有 **正式业务 ingress** 先进入宿主统一入口
- 再由宿主 adapter 转给该 imported app 声明的边界 pin
- imported app 内部后续怎样继续 relay、调用 helper、继续外发，仍由 app 自己定义

补充：

- 本地 UI 草稿态不属于这条统一 ingress
- 它们继续保留在本地 UI / overlay / 延后提交链路中

## 3. Decision 1：哪些事件属于宿主正式 ingress

### 3.1 不进入宿主正式 ingress 的事件

以下事件属于 **本地 UI 态**，不应被强制统一到宿主 `Model 0`：

- input 正在输入中的草稿值
- 本地 overlay value
- hover / focus / 展开态 / 临时选中态
- on_blur 之前尚未提交的编辑草稿
- 其他只影响本地交互体验、尚未进入正式业务链的 UI 临时状态

这些事件仍可继续使用：

- 前端本地草稿
- 负数状态模型
- on_blur / on_submit / delayed commit

### 3.2 必须视为宿主正式 ingress 的事件

以下事件属于 **正式业务 ingress**，候选规约要求统一进入宿主入口：

- submit
- confirm
- create
- delete
- import
- send
- execute
- invoke
- 其他会触发：
  - imported app 正式业务程序模型
  - 宿主持久化/资源变更
  - 对外 transport
  - 跨模型正式 relay

判断标准只有一条：

- 如果这个事件已经不再是“本地 UI 草稿”，而是要进入正式业务链，就属于宿主正式 ingress。

## 4. Decision 2：安装时宿主自动补哪些 adapter

imported app 安装完成后，宿主应自动补一层 **host-owned adapter**。

这层 adapter 的职责只有 3 类：

1. 定义 imported app 的宿主入口
   - 宿主如何识别这个 imported app 的正式 ingress
2. 将宿主入口 relay 到 imported app 的边界 pin
   - 由宿主生成 relay / mount adapter
3. 隔离宿主边界与 app 内部实现
   - 宿主不直接耦合 imported app 的内部 helper pin / 中间 cell

宿主自动补的 adapter 可以包含：

- `Model 0` ingress key / ingress pin
- imported app 对应的 relay pin
- host-to-app 的 `pin.connect.*` 或等价 wiring
- 与安装时分配出的目标模型号绑定的挂载适配层

宿主 **不应** 自动做这些事：

- 直接把 imported app 的内部 helper pin 暴露给外部
- 直接把 imported app 的内部 cell 坐标当作长期公共入口
- 把 imported app 的内部 relay 细节写死到用户侧说明中

一句话：

- imported app 的内部实现归 app 自己
- imported app 的宿主接入链归宿主自动生成

## 5. Decision 3：imported app 最少要暴露哪些边界 pin

imported app 后续若要接入宿主正式 ingress，至少要显式暴露 **边界 pin**。

这些边界 pin 的要求是：

- 它们是 host-facing 入口
- 它们代表 imported app 愿意让宿主接入的正式业务入口
- 宿主只能连接这些已声明的边界 pin
- 宿主不应越过这些边界 pin，直接接内部 helper / relay

最少声明内容应包含：

1. pin 名称
   - 宿主接哪一个入口
2. pin 输入值类型
   - 宿主写什么类型的值
3. ingress 类别
   - 必须是正式业务 ingress，而不是本地 UI 草稿入口
4. 边界语义
   - 例如 submit / confirm / create / delete / invoke
5. 稳定定位信息
   - 宿主如何唯一定位这个边界 pin 所在的 cell

### 5.1 稳定定位要求

宿主后续要自动补 `pin.connect.*`，不能只知道“有一个叫 submit 的 pin”。

因此，每个 host-facing 边界 pin 还必须提供 **稳定定位信息**，使宿主在安装时可以唯一确定接线目标。

本规约要求至少满足这 3 条：

1. 宿主必须能在 imported app 内唯一定位到该边界 pin
   - 不能靠“扫描到第一个同名 pin 就接上”
2. 定位结果必须稳定
   - 不能依赖导入后随机生成的临时顺序
   - 也不能依赖宿主去猜内部 helper / relay 结构
3. 边界 pin 的定位应当相对于 imported app 自己的根来表达
   - 而不是写成宿主安装后的外部绝对模型号

### 5.2 当前冻结的最小定位语义

这一版先冻结语义，不冻结最终 label schema。

也就是说，后续实现至少要能表达出下面这些信息：

- `pin_name`
- `semantic`
- `value_t`
- `locator_kind`
- `locator_value`

其中：

- `locator_kind`
  - 表示宿主该按哪种方式定位
- `locator_value`
  - 表示对应的具体定位值

### 5.3 宿主可接受的定位方式

后续实现中，至少应支持其中一种稳定定位方式：

1. root-relative cell locator
   - 例如：相对于 imported app root 的 `(p,r,c)` + `pin_name`
2. import-time resolvable boundary id
   - 例如：一个专门声明给宿主解析的边界入口 id
   - 宿主能在导入时把它解析到唯一 cell + pin

两种方式里，第一种是默认推荐方向：

- root-relative
- 唯一
- 可在导入时立即解析

### 5.4 不允许的定位方式

以下方式不应作为正式宿主接线依据：

- “宿主扫描全模型，找到第一个同名 pin”
- “宿主扫描所有同语义入口，自行挑一个”
- “宿主直接接 imported app 的内部 helper pin / relay pin”
- “宿主依赖安装后派生出的外部共享 AST 或投影结果反推入口”

### 5.5 多入口时的规则

如果 imported app 内存在多个同语义入口，必须显式声明：

- 哪一个是宿主正式 ingress 的 primary 边界 pin

宿主后续只允许自动连接被声明为 primary 的那个边界入口。

本规约在这一版 **不强行冻结具体 label schema**。  
也就是说：

- 本页先冻结“必须存在边界 pin、最少语义以及稳定定位信息”
- 具体如何声明成 label / projection / import metadata
- 留到后续实现或更细粒度规约再定

## 6. 宿主与 imported app 的职责分界

### 6.1 宿主负责

- 安装时分配模型号
- 安装时生成宿主 adapter
- 统一接收正式业务 ingress
- 把 ingress relay 到 imported app 的边界 pin
- 继续负责宿主侧审计、资源边界与系统 transport

### 6.2 imported app 负责

- 声明自己的边界 pin
- 定义边界 pin 进入后怎样走内部 pin 链
- 定义内部 helper / relay / root 程序模型
- 定义后续业务结果如何在 app 内部继续传播

## 7. 对现有文档的影响

这份规约的直接影响是：

- 现有总览页、导入页、执行型导入页后续可以引用它
- 但在实现真正变化前，不应把本页内容改写成“当前已实现事实”

尤其要避免把下面这句话提前写成现状：

- “所有正式业务事件已经统一经 Model 0 ingress”

在对应实现迭代完成前，这仍然只是候选架构，不是 live code 事实。

## 8. 下一步实现题目

如果进入实现阶段，后续迭代至少要回答：

1. imported app 的边界 pin 如何声明成可导入的正式结构
2. 安装时宿主如何自动生成 host adapter
3. 哪些现有 direct-pin path 要继续保留，哪些 imported app path 要改成统一 ingress

在这三件事未落地前，本页只作为 **候选正式架构冻结** 使用。

---
title: "0383 - UI Server Matrix Suite Slide App Plan"
doc_type: iteration-plan
status: approved
updated: 2026-05-19
source: ai
iteration_id: 0383-ui-server-matrix-suite-slide-app
id: 0383-ui-server-matrix-suite-slide-app
phase: approved
---

# Iteration 0383-ui-server-matrix-suite-slide-app Plan

## Goal

- 新增一个 UI Server 自带的 `Matrix Suite` 滑动 App，用细粒度 `cellwise.ui.v1` UI 模型和程序模型表达聊天客户端能力。
- 设计参考 Matrix / Element 类聊天产品的信息架构：左侧应用轨、中间会话列表、主时间线、右侧详情/设置面板。
- 核心交互必须通过当前正式链路进入 Model 0：`UI event -> bus_event_v2 -> Model 0 pin.bus.cb.in -> Model 0 hosting cell -> Matrix Suite root pin.in -> 程序模型`。

## Scope

- In scope:
- 新增 `Matrix Suite` Workspace 入口，并保持 0382 后的 Workspace 入口 allowlist 可控扩展。
- 新增细粒度 UI 模型：搜索、会话列表、1v1/多人频道、消息时间线、composer、编辑消息、文件/语音/视频/屏幕共享入口、设置与密码管理状态。
- 新增程序模型：处理发送消息、编辑消息、创建频道、重命名频道、删除频道、选择频道、发起 video/audio/screen/file 事件、保存设置等动作，并把结果写回本模型表。
- 新增自动化合同检查，覆盖 UI 粒度、入口可见性、Model 0 ingress、禁止前端 direct Matrix send、必需能力是否全部出现。
- 本地部署后用真实浏览器验证 Workspace 打开、新 app 核心交互和颜色生成器仍可用。
- Out of scope:
- 本次不把 `matrix-js-sdk` 直接引入前端；前端只做 UI 投影与事件投递。
- 本次不实现完整 E2EE、真实 WebRTC 媒体流传输、真实录音采集、真实屏幕采集；这些能力在模型表中表达为 Matrix-like 事件和可扩展程序入口，后续可由 worker 侧 adapter 接管真实传输。
- 本次不改变 MBR / remote-worker 的现有 bus 合同，不重填无关 worker。

## Invariants / Constraints

- ModelTable 是 UI 与业务状态真源；UI 只能投影，不直接拥有业务状态。
- 正式业务事件必须经 Model 0 `pin.bus.cb.in` 进入，再通过 Model 0 内的 `model.submt` hosting cell 引脚进入目标子模型第 0 格；不得新增前端直连 Matrix、MQTT 或任意 worker 的路径。
- 传入程序模型的 payload 必须是临时 ModelTable record array；程序模型只通过 `add_label` / `rm_label` 或 table-scoped owner 写入更新状态。
- UI 模型必须保持细粒度：页面由多个 cell 组合，不允许把整个聊天界面塞进单个 HTML 字符串。
- 密码/密钥管理只能展示配置状态和触发维护动作，不得把真实 secret 写入 repo 或暴露在 UI 示例数据中。
- 本次新增 app 是 UI Server 自带滑动 App，不替代未来 Workspace Manager / PICS 提供的可安装远端 App。

## Success Criteria

- `docs/ITERATIONS.md` 登记 0383，并且 plan/resolution/runlog 均有 frontmatter 与 review gate 记录。
- `Matrix Suite` 出现在 Workspace 资产树；原 8 个保留入口仍存在且不被误删。
- 打开 `Matrix Suite` 后可见现代聊天布局：应用轨、搜索/过滤、会话列表、时间线、composer、详情/设置区域。
- 浏览器中至少完成：选择会话、发送消息、编辑消息、新建频道、重命名频道、删除频道、触发 video / voice / screen 事件、通过 `FileInput` 上传小文件后 share file、保存设置；这些动作均通过 `bus_event_v2` 路径触发程序模型并更新页面。
- 自动检查证明：新增模型有 `cellwise.ui.v1` authoring、足够细粒度组件、Model 0 ingress route、无 direct Matrix frontend call、所列功能入口齐全。
- 本地构建、相关脚本测试、本地部署和真实浏览器验证均 PASS。

## Inputs

- Created at: 2026-05-19
- Iteration ID: 0383-ui-server-matrix-suite-slide-app
- External reference: `matrix-org/matrix-js-sdk` client concepts; only used as design reference, not as direct frontend dependency.

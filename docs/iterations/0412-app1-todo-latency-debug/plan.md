---
title: "Iteration 0412 app1 ToDo Latency Debug Plan"
doc_type: iteration_plan
status: in_progress
updated: 2026-06-10
source: ai
---

# Iteration 0412-app1-todo-latency-debug Plan

## Goal

在远端隔离部署 `https://app1.dongyudigital.com/` 调试入口，安装并验证 R1 提供的 `To Do app 1`，用真实浏览器操作和同一 `op_id` 的链路证据定位新增任务流程的主要耗时段。

## Scope

- In scope:
  - 新增隔离的 `ui-server-1` cloud runtime surface，包含 Deployment / Service / Ingress / 持久化目录 / worker id。
  - 将现有 To Do Board 模型打包为 R1 provider-owned bundle，并注册为 Workspace Manager 可安装资产 `To Do app 1`。
  - 对安装流程和 ToDo 新增任务流程增加轻量观测，按 `op_id` 记录浏览器、ui-server、MBR、R1 的关键时间点。
  - 远端部署到 `app1.dongyudigital.com`，并用真实浏览器完成安装和新增任务验收。
  - 输出分段耗时表、瓶颈判断、证据路径和回滚状态。
- Out of scope:
  - 不改变现有 `https://app.dongyudigital.com/` 的入口、持久化状态或用户可见行为。
  - 不修改集群运行时、网络、CNI、防火墙、rke2/k3s/containerd/docker/sshd/systemctl。
  - 不引入新的业务总线语义；ToDo 安装与运行必须继续走现有 Model 0 / pin bus / MQTT 合同。
  - 不把本轮性能问题直接修复为架构改动；先完成证据定位，除非发现阻塞调试的最小 bug。

## Invariants / Constraints

- `CLAUDE.md` 优先级最高；远端只允许安全的 `kubectl get/apply/logs/describe/exec`、镜像构建/导入、文件同步等操作。
- 所有 UI 业务事件必须从 UI Server Model 0 系统总线边界进入，不能让浏览器或外部 MQTT 直接写业务状态。
- provider-owned 安装路径保持：Workspace Manager 是索引，R1 提供 bundle，UI Server 只在收到并校验 provider 返回后 materialize 本地实例。
- `ui-server-1` 必须与现有 `ui-server` 隔离：独立 Deployment/Service/Ingress、独立 hostPath、独立 `DY_UI_SERVER_WORKER_ID`。
- ToDo provider bundle 不能包含 host-owned 运行态真值、legacy topic/route 字段、secret 或不可导入标签。
- 性能结论必须来自真实远端日志、浏览器观测或脚本输出，不能只基于代码推断。

## Success Criteria

- `https://app1.dongyudigital.com/` 返回可用 UI，且 `https://app.dongyudigital.com/` 仍保持可用。
- 远端 `ui-server-1` pod Ready，`/snapshot` 与 `/stream` 可访问，worker id 与持久化目录独立。
- Workspace Manager 列表出现 R1 提供的 `To Do app 1`，点击安装后 `ui-server-1` 出现新的本地 ToDo 实例。
- 浏览器真实操作通过：点击“新增任务”弹窗打开；填写标题、内容、状态后提交；新任务出现在 ToDo 四列之一；内部滚动和弹窗无遮挡问题。
- 至少三次新增任务流程产生可比较的分段耗时，覆盖：
  - 浏览器点击到请求发出；
  - `ui-server-1` 收到事件到发出总线请求；
  - MQTT / MBR 转发到 R1；
  - R1 处理；
  - R1 回包到 `ui-server-1`；
  - `ui-server-1` snapshot/SSE 到浏览器可见更新。
- runlog 记录远端命令、关键输出、浏览器验证结果、性能数据和回滚命令。

## Inputs

- Created at: 2026-06-10
- Iteration ID: 0412-app1-todo-latency-debug
- User approval: 2026-06-10, user said "可以，开始".

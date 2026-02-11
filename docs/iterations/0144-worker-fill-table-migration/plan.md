# 0144: Worker Fill-Table Migration

## WHAT

将 K8s 部署的两个 worker（remote-worker、mbr-worker）迁移到新版基座（0141-0143 引入的 BUS_IN/OUT + cell_connection + CELL_CONNECT + runtime 内置 MQTT 循环），以"填表"方式定义 worker 行为。

## WHY

1. 0141-0143 完成了 runtime 基座升级（3 层连接架构 + AsyncFunction 引擎），但 K8s worker 仍使用旧模式：
   - `run_remote_worker_k8s_v2.mjs`: 手动 MQTT 配置、WorkerEngineV0.tick() 轮询、硬编码心跳
   - `run_worker_v0.mjs` (MBR): 手动 MQTT 订阅/消息处理、手动 Matrix 事件处理、run_* trigger 模式
2. CLAUDE.md `fill-table-first` 原则要求：可用填表实现的能力必须用填表，不用硬编码 JS
3. `remote_worker_model.json` 使用已废弃的 PIN_IN/ctx.setLabel 模式，与新架构不兼容

## SCOPE

### In Scope
- Remote Worker: 重写 bootstrap 脚本 + 创建 role patch + 使用 runtime startMqttLoop
- MBR Worker: 验证与新基座兼容 + 更新订阅声明为 MQTT_WILDCARD_SUB
- Docker 镜像重建 + K8s 部署更新
- E2E 验证（真实 Docker/K8s 环境）

### Out of Scope
- MBR bootstrap 的 Matrix adapter 集成（外部适配器，保留现有 JS glue）
- MBR 的 run_* trigger 模式（WorkerEngineV0 对 MBR 仍有价值，因 Matrix side 需要）
- uiput_9layer_v2 topic 模式（本迭代保持 uiput_mm_v1）
- 前端变更
- runtime.js 代码变更（纯填表迭代）

## CONSTRAINTS

- 零 runtime.js 代码变更（纯 tier 2 填表 + 脚本变更）
- MBR bridge 函数（mbr_mgmt_to_mqtt, mbr_mqtt_to_mgmt）已是模型定义，保留现有逻辑
- 所有 MQTT 订阅通过 MQTT_WILDCARD_SUB 标签声明（不硬编码 topic）
- E2E 必须在真实 Docker/K8s 环境通过 pre-flight 后执行

## ARCHITECTURE DECISIONS

### AD-1: Remote Worker 不需要 WorkerEngineV0
新基座的完整链路：`startMqttLoop → mqttIncoming → IN label → _routeViaCellConnection → _propagateCellConnect → AsyncFunction` 是全自动的。Remote worker 只需加载 patch + 启动 MQTT 循环。

### AD-2: MQTT 订阅用 MQTT_WILDCARD_SUB 填表声明
runtime 的 `_subscribeDeclaredPinsOnStart()` 已支持扫描所有 model 的 MQTT_WILDCARD_SUB 标签。无需 tier 1 变更。

### AD-3: MBR 保留 WorkerEngineV0 + 手动 MQTT
MBR 监听其他 worker 的输出 topic（如 `base/100/patch_out`），但 MBR runtime 中不存在 Model 100。`mqttIncoming` 会因 `getModel(100) === null` 而丢弃消息。因此 MBR 必须保留手动 MQTT 消息处理。

### AD-4: Remote Worker 用 run_worker_v0.mjs 统一入口
不为 remote worker 写新脚本。复用 `run_worker_v0.mjs` 的 patch 目录加载模式，创建 `deploy/sys-v1ns/remote-worker/patches/` 目录。

## RISK

| Risk | Impact | Mitigation |
|------|--------|------------|
| MBR bridge 函数与 0143 的 IN routing 变更不兼容 | MBR 停止转发 | Step 3 兼容性验证 |
| MQTT_WILDCARD_SUB 订阅 topic 格式错误 | Remote worker 收不到消息 | Step 5 单元测试 |
| Docker 镜像构建失败 | 无法部署 | Step 7 构建验证 |
| run_worker_v0.mjs 对 remote-worker 缺少必要配置 | 启动失败 | Step 4 本地验证 |

# Dual-Worker Sliding UI E2E (v0)

本文档是双工人链路的统一说明（原“测试指南 + 报告”合并版）。

目标闭环：

`UI-side -> MgmtBus(Matrix) -> MBR -> MQTT -> Remote worker -> MQTT -> MBR -> MgmtBus -> UI-side`

消息口径：`ModelTablePatch v0 (mt.v0)`。

## 1. 范围与约束

- UI 只写 mailbox，不直接发总线消息。
- 副作用必须经 `add_label/rm_label` 触发。
- 生产环境 secrets 不入仓库，不进入 runlog/snapshot。

参考：
- `docs/ssot/runtime_semantics_modeltable_driven.md`
- `docs/iterations/0132-dual-bus-contract-harness-v0/contract_dual_bus_v0.md`

## 2. 前置检查

```bash
curl -sk https://matrix.localhost/_matrix/client/versions
nc -zv 127.0.0.1 1883
```

两项都通过后再执行 E2E。

## 3. 环境变量（示例）

```bash
export MATRIX_HOMESERVER_URL="https://matrix.localhost"
export MATRIX_MBR_USER="drop"
export MATRIX_MBR_PASSWORD="<your_password>"
export NODE_TLS_REJECT_UNAUTHORIZED=0
export DY_REMOTE_MODEL_ID=2
export DY_MQTT_HOST=127.0.0.1
export DY_MQTT_PORT=1883
export DY_MQTT_USER=u
export DY_MQTT_PASS=p
```

## 4. 执行步骤

### 4.1 准备测试 room_id

```bash
node scripts/matrix_bootstrap_room_v0.mjs
```

导出输出的 `ROOM_ID`：

```bash
export DY_MATRIX_ROOM_ID="!xxxx:matrix.localhost"
```

### 4.2 启动三类进程

```bash
node scripts/run_worker_ui_side_v0.mjs
node scripts/run_worker_mbr_v0.mjs
node scripts/run_worker_remote_v0.mjs
```

### 4.3 触发并验证

```bash
node scripts/validate_dual_worker_slide_e2e_v0.mjs
```

必须看到：
- `PASS`
- 同一 `op_id` 的跨总线链路日志
- Remote applyPatch 成功、UI-side snapshot 可观测变化

## 5. 验收标准

1. UI-side 发出 `ui_event`，带 `op_id`。
2. MBR 执行 `op_id` 去重并发布到 MQTT。
3. Remote 能解析 `mt.v0` 并应用 patch。
4. 回传链路完整（Remote -> MQTT -> MBR -> MgmtBus -> UI-side）。
5. 日志与输出不泄露 token/password。

## 6. 已验证结论（v0）

已在本地完成 Matrix + MQTT 的最小双总线闭环验证，链路可跑通。  
当前定位是“合同与 harness 可验证阶段”，并不等价于“前端已全面接入真实双总线生产链路”。

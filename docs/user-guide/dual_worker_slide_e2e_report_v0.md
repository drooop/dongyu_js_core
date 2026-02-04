# Dual-Worker Sliding UI E2E Report (v0)

本报告记录一次“本地双工人 + Matrix 管理总线 + MQTT 控制总线 + ModelTable 驱动 MBR”的端到端验证。

## 1) 目标

验证一次“滑动事件”可以完成全链路闭环：

`UI-side worker -> MgmtBus(Matrix) -> MBR(worker) -> MQTT -> Remote worker -> MQTT -> MBR -> MgmtBus -> UI-side worker`

并且跨总线转发的消息体为 `ModelTablePatch v0 (mt.v0)`。

## 2) 部署拓扑

- Matrix homeserver: `matrix.localhost`（Synapse，通过 https 反代）
- Matrix client: `packages/bus-mgmt/src/matrix_live.js`（matrix-js-sdk）
- MQTT broker: `127.0.0.1:1883`（本地 docker 映射）
- 进程：
  - UI-side worker: `scripts/run_worker_ui_side_v0.mjs`
  - MBR worker: `scripts/run_worker_mbr_v0.mjs`
  - Remote worker: `scripts/run_worker_remote_v0.mjs`

## 3) 关键机制（为什么这算“ModelTable 驱动的 MBR”）

MBR 不是直接在 JS 回调里做转发决策，而是：

1) host 只负责把“入站消息”落成 system negative model 的 label（inbox），再写 `run_*`。
2) 真正的桥接逻辑在 ModelTable 中以 `t="function"` 保存，并由 `run_*` 触发执行。
3) 出站动作仍落为 `add_label/rm_label`（例如写 `MGMT_OUT`），再由引擎观察 eventLog 触发 `run_mgmt_send`。

对齐约束：
- 副作用触发入口：`add_label/rm_label`（见 `docs/ssot/runtime_semantics_modeltable_driven.md`）
- MGMT_OUT 只允许在系统负数模型域声明（同上）

## 4) 实测结果（PASS 证据）

执行：

```bash
MATRIX_HOMESERVER_URL="https://matrix.localhost" \
MATRIX_MBR_USER="drop" \
MATRIX_MBR_PASSWORD="<redacted>" \
NODE_TLS_REJECT_UNAUTHORIZED=0 \
node scripts/validate_dual_worker_slide_e2e_v0.mjs
```

关键链路证据（从脚本输出中可见）：
- 生成 op_id：`op_slide_<ts>`
- MBR 收到 mgmt ui_event：`[mbr-worker] recv mgmt ui_event op_id=...`
- MBR 发 MQTT patch：`[mbr-worker] mqtt publish ... op_id=...`
- Remote applyPatch 并回传：`[remote-worker] applied patch and queued OUT { in_op_id, out_op_id }`
- MBR 收到 MQTT patch_out 并发回 mgmt snapshot_delta：`sendEvent of type dy.bus.v0 ...`
- UI-side 收到 snapshot_delta 并 apply：`[ui-worker] recv snapshot_delta op_id=...`
- 最终断言 PASS：`dual_worker_slide_e2e_v0: PASS room_id=... op_id=...`

## 5) 当前限制与后续工作

1) 目前这个 E2E 走的是最小 demo：
- UI-side 的“滑动事件”在脚本里直接构造为 patch 并发到 mgmt；还没接入真实前端页面的滑动手势。

2) MQTT payload 兼容性
- 为了同时不破坏旧的 IN/OUT wrapper 语义，本次在 runtime 增加了 `mqtt_payload_mode`：
  - `legacy`：沿用 `{t:'IN'|'OUT', pin, value}` 结构
  - `mt_v0`：MQTT payload 直接为 `ModelTablePatch v0`

3) 安全
- 仅本地测试允许 `NODE_TLS_REJECT_UNAUTHORIZED=0`；生产禁止。
- 密码/token 不写入仓库文件，不输出到文档中。

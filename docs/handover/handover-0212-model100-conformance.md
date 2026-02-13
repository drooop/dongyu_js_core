# Handover: Model 100 subModel Conformance + Management Bus Integration

**Date**: 2026-02-12
**Session**: Brainstorming (in progress, paused at Design Section 1)
**Branch**: `dev`

---

## 1. Session Accomplished

### 1.1 MBR Matrix Connection Fix (COMPLETED)

**Problem**: MBR worker 无法连接 Matrix (Synapse)，原因是 `k8s/mbr-worker-deployment.yaml` 中 hostAliases IP 过期 (`172.18.0.13`)，实际 nginx 容器 IP 为 `172.18.0.11`。

**Fix**:
- 更新 `k8s/mbr-worker-deployment.yaml`: hostAliases IP → `172.18.0.11`, image tag `v1` → `v2`
- 重建 `dy-mbr-worker:v2` Docker image
- K8s rollout restart (ConfigMap 更新需要 restart 才生效)
- 结果: Matrix adapter 连接成功 `mgmt READY room_id=!rvgIBRtgXATQGGRWiS:localhost`
- E2E 验证: MQTT→MBR→Matrix 事件转发正常
- Runtime baseline 6/6 PASS, regression 12/12 PASS

**注意**: 中途尝试过 `host.docker.internal` 方案，因 docker-desktop TLS passthrough 问题失败，最终确认 direct Docker IP + hostAliases 是 K8s pod 访问 Docker 容器的正确方式。

**待 commit**: `k8s/mbr-worker-deployment.yaml` 的变更尚未 commit。

### 1.2 Model 100 subModel Conformance Brainstorm (IN PROGRESS)

进入 brainstorming skill 讨论 Model 100 如何符合 0141-0144 建立的 3 层连接架构。

---

## 2. Brainstorm History & Decisions

### Q1: MQTT Topic Strategy — Remote Worker 如何订阅？

**选项**:
- A) 改 topic 到 Model 0 (纯 fill-table, 零代码改动) ← **选择此项**
- B) 维持直接订阅 Model 100 topic (需要 runtime 改动)

**决定**: 改 topic 到 Model 0。Remote Worker 订阅 `UIPUT/.../0/m100_event` 而非 `UIPUT/.../100/event`。BUS_IN short-circuit 在 `mqttIncoming` 中自然处理路由。

**理由**: 符合 CLAUDE.md 约束 "single external entry: BUS_IN/BUS_OUT on Model 0"，纯 fill-table 方案，零 runtime 代码改动。

### Q2: Management Bus (Matrix) — MBR 如何知道目标 topic？

**用户要求**: "MBR 内部不应该硬编码 topic，应该是管理总线发到 MBR 时，MBR 能根据消息体内的模型 patch 数据知道 topic"

**确认**:
- MQTT wildcard 订阅确实能将具体 topic 传递给回调 (`packet.topic`)
- MBR bridge 函数 (`mbr_mgmt_to_mqtt`) 已经从消息体动态提取 `targetModelId` 和 `pinName`
- 只需修改 topic 构造公式: `base + '/' + targetModelId + '/' + pinName` → `base + '/0/m' + targetModelId + '_' + pinName`

### Q3: Label Type 命名 — 是否采用飞书文档的 pin.* 体系？

**参考文档**: 飞书文档《软件工人支持的Label标签》定义了层级化 pin 系统:
- `pin.v1n.in/out` (系统边界, 等同 BUS_IN/OUT)
- `pin.model.in/out` (模型边界, 等同 MODEL_IN/OUT)
- `pin.cell.in/out` (单元格边界)
- `pin.func.in/out` (函数边界)
- `pin.model.connect` / `pin.cell.connect` (连接表)

**决定**: 暂作为思路参考，不立即决定命名迁移。当前 runtime 使用 BUS_IN/BUS_OUT/MODEL_IN/MODEL_OUT/CELL_CONNECT/cell_connection 命名，功能完备。

**分析**: 飞书文档的 pin.* 体系层次更清晰，但需要 runtime `_applyBuiltins` 全面改动 + 所有 patch 文件迁移。当前命名体系已能覆盖所有场景，可在未来迭代中考虑。

### Q4: CELL_CONNECT 混合使用 — 跨模型 + 单元格内 wiring 是否混在同一张表？

**选项**:
- A) 接受混合 (跨模型用数字前缀 `(100, cmd)`, 单元格内用 `(self, func)`) ← **选择此项**
- B) 分成两种 label type

**决定**: 可以接受混合。CELL_CONNECT 统一处理跨模型路由(数字前缀)和单元格内 wiring(`self`/`func`)。

---

## 3. Design Section 1: Model 0 Framework BUS_IN Entry (PRESENTED, AWAITING FEEDBACK)

已向用户展示的设计段落:

### BUS_IN Port 声明 (Model 0, Cell 0,0,0)

```json
{"model_id": 0, "p": 0, "r": 0, "c": 0, "k": "m100_event",   "t": "BUS_IN",  "v": "m100_event"}
{"model_id": 0, "p": 0, "r": 0, "c": 0, "k": "m100_patch",   "t": "BUS_IN",  "v": "m100_patch"}
{"model_id": 0, "p": 0, "r": 0, "c": 0, "k": "m2_patch_in",  "t": "BUS_IN",  "v": "m2_patch_in"}
```

### 命名约定

`m{modelId}_{pinName}` — 例如 `m100_event`, `m100_patch`, `m2_patch_in`

### MQTT 订阅

自动: `_subscribeDeclaredPinsOnStart()` 扫描 BUS_IN label → 订阅 `UIPUT/.../0/m100_event` 等 topic。不再需要 MQTT_WILDCARD_SUB。

### 消息流

```
MQTT msg (topic: UIPUT/.../0/m100_event)
  → mqttIncoming: modelId=0, pinName=m100_event
  → busInPorts.has('m100_event') → BUS_IN short-circuit
  → _handleBusInMessage → writes BUS_IN label on Model 0 (0,0,0)
  → _applyBuiltins → _routeViaCellConnection
  → cell_connection routes to hosting cell
```

### 约束确认

BUS_IN 只在 Model 0 Cell (0,0,0) 上。runtime 对其他位置的 BUS_IN 报 `bus_in_wrong_position` 错误。

**问题**: "这个段落方向对吗？特别是 `m{id}_{pin}` 命名约定你觉得合适吗？" ← 用户尚未回答

---

## 4. Remaining Design Sections (TODO)

brainstorming skill 要求每段 200-300 字，逐段确认。以下为待展示段落:

### Section 2: Model 0 cell_connection Routing
- BUS_IN port → hosting cell 的 cell_connection 路由声明
- 例: `[0,0,0, "m100_event"] → [1,0,0, "cmd"]` (hosting cell 接收)
- hosting cell 是 Model 100 作为 subModel 挂载的位置

### Section 3: subModel Declaration + CELL_CONNECT Bridge (Model 0)
- Model 0 Cell (1,0,0) 声明 `subModel` label: `{k: "100", t: "subModel", v: {alias: "color_gen"}}`
- CELL_CONNECT bridge on (1,0,0): `(self, cmd) → (100, cmd)` 和 `(100, result) → (self, result_out)`
- 数字前缀 `(100, cmd)` 路由到 child model 100 的 MODEL_IN

### Section 4: Model 100 Internal Architecture
- MODEL_IN at (0,0,0) 接收来自父模型的消息
- cell_connection 路由: `[0,0,0, "cmd"] → [1,0,0, "process"]`
- CELL_CONNECT on (1,0,0): `(self, process) → (func, handle_event)` 触发 AsyncFunction
- 函数执行后写入输出 label → MODEL_OUT 回传

### Section 5: MBR Bridge Function Topic Change
- `mbr_mgmt_to_mqtt` topic 公式: `base + '/0/m' + targetModelId + '_' + pinName`
- `mbr_mqtt_to_mgmt` 不变 (仍从 topic 解析 model info)
- MBR 不硬编码 topic，从消息体动态派生

### Section 6: BUS_OUT for Response
- Model 100 → MODEL_OUT → CELL_CONNECT bridge → cell_connection → BUS_OUT → MQTT publish
- BUS_OUT port 命名: `m100_result`, `m100_patch_out`

### Section 7: Spec Documentation Updates
- 更新 `docs/ssot/runtime_semantics_modeltable_driven.md`
- 更新 `docs/user-guide/modeltable_user_guide.md`
- 更新 CLAUDE.md MODEL_ID_REGISTRY 和相关约定

---

## 5. Key Reference Files

| File | Purpose |
|------|---------|
| `packages/worker-base/src/runtime.js` | Runtime 引擎 (tier 1) |
| `scripts/tests/fixtures/test_model0_framework.json` | Model 0 + subModel 参考架构 |
| `deploy/sys-v1ns/remote-worker/patches/` | Remote Worker 角色 patch |
| `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json` | MBR bridge 函数 |
| `scripts/run_worker_remote_v1.mjs` | Remote Worker v3 启动脚本 |
| `scripts/run_worker_v0.mjs` | MBR Worker 启动脚本 |
| `k8s/mbr-worker-deployment.yaml` | MBR K8s 部署 (已修改, 待 commit) |

### Runtime Key Line Numbers

- `_applyBuiltins`: runtime.js:1192-1367
- `_subscribeDeclaredPinsOnStart`: runtime.js:751-768
- `mqttIncoming` BUS_IN short-circuit: runtime.js:814-818
- `_handleBusInMessage`: runtime.js:1183-1188
- `_routeViaCellConnection`: runtime.js:1036-1045
- `_propagateCellConnect` (numeric prefix → subModel): runtime.js:1086-1103
- subModel registration: runtime.js:1249-1268
- MODEL_IN/MODEL_OUT: runtime.js:1269-1306

---

## 6. Next Steps (Resume Checklist)

1. **继续 brainstorm**: 等用户确认 Section 1 (BUS_IN port naming)，然后逐段展示 Section 2-7
2. **brainstorm 完成后**: 将确认的设计写入 `docs/plans/2026-02-12-model100-conformance-design.md`
3. **创建迭代**: 在 `docs/ITERATIONS.md` 注册新 iteration (e.g. `0145-model100-submodel-conformance`)
4. **Commit 待处理**: `k8s/mbr-worker-deployment.yaml` hostAliases IP fix 需要 commit
5. **实现**: 按设计 patch Model 0 framework + 修改 MBR bridge 函数 + 更新 Remote Worker patches
6. **验证**: unit test (Model 0 framework routing) + E2E (MQTT → Model 0 → Model 100 → response)

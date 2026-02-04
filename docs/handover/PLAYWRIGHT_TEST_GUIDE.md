# Playwright 测试指南

本文档指导 OpenCode 如何使用 Playwright MCP 工具复现之前成功的测试。

## 目标

验证 UI → Matrix → MBR → MQTT 链路畅通，具体流程：

```
用户在浏览器修改颜色 → 点击 Submit
    ↓
UI 发送 POST /ui_event
    ↓
UI Server 写入 Mailbox (Model -1, Cell 0,0,1)
    ↓
程序模型 forward_ui_events 触发
    ↓
ctx.sendMatrix() 发送到 Matrix DM
    ↓
MBR Worker 收到 Matrix 消息
    ↓
MBR 转发到 MQTT topic: UIPUT/ws/dam/pic/de/sw/2/...
```

## 前置条件

1. UI Server 正在运行 (http://127.0.0.1:9000)
2. MBR Worker 正在运行（连接 Matrix + MQTT）
3. Playwright MCP 已配置（OpenCode 默认支持）

## 测试步骤

### 1. 导航到 UI

```javascript
browser_navigate({ url: "http://127.0.0.1:9000" })
```

**预期结果**: 页面加载成功，显示 ModelTable 编辑器界面。

### 2. 等待页面加载

```javascript
browser_wait_for({ time: 2 })
```

### 3. 获取页面快照（了解页面结构）

```javascript
browser_snapshot()
```

**预期看到**:
- 测试区域（testarea）
- 颜色输入框（可能是 textbox 或 color input）
- Submit 按钮

### 4. 定位颜色输入框

根据 snapshot 结果，找到颜色输入框的 `ref`。

**示例 snapshot 输出**（简化版）:
```
textbox "Color" [ref="123"]
button "Submit" [ref="456"]
```

### 5. 修改颜色值

```javascript
browser_type({
  ref: "123",  // 从 snapshot 中获取的实际 ref
  text: "#ff00ff",
  element: "Color input field"
})
```

**预期结果**: 输入框的值变为 `#ff00ff`。

### 6. 点击 Submit 按钮

```javascript
browser_click({
  ref: "456",  // 从 snapshot 中获取的实际 ref
  element: "Submit button"
})
```

**预期结果**:
- UI 发送请求到 `/ui_event`
- 页面可能有视觉反馈（例如测试区域颜色变化）

### 7. 等待请求完成

```javascript
browser_wait_for({ time: 2 })
```

### 8. 验证（可选截图）

```javascript
browser_take_screenshot({
  filename: "after_submit.png",
  type: "png"
})
```

## 验证日志输出

测试完成后，检查服务日志。

### UI Server 日志

**应该看到**:
```
[forward_ui_events] Sending to Matrix: label_update
FetchHttpApi: --> PUT https://matrix.localhost/_matrix/client/v3/rooms/...
FetchHttpApi: <-- PUT ... [200]
Event sent to !rvgIBRtgXATQGGRWiS:localhost with event id $...
```

**关键指标**:
- ✅ `[forward_ui_events] Sending to Matrix` 出现
- ✅ `Event sent to !rvgIBRtgXATQGGRWiS:localhost` 出现
- ✅ 返回状态码 200
- ✅ 有 event id（`$` 开头的字符串）

### MBR Worker 日志

**应该看到**:
```
[mbr-worker] Received Matrix message from @drop:localhost
[mbr-worker] Message type: ui_event
[mbr-worker] Publishing to MQTT: UIPUT/ws/dam/pic/de/sw/2/label_update
[mbr-worker] MQTT publish OK
```

**关键指标**:
- ✅ `Received Matrix message` 出现
- ✅ `Publishing to MQTT` 出现，topic 正确
- ✅ `MQTT publish OK` 出现

## 故障排查

### 问题 1: Snapshot 找不到输入框

**症状**: `browser_snapshot()` 结果中没有颜色输入框。

**可能原因**:
- 页面还在加载中
- UI 渲染异常

**解决**:
1. 增加等待时间: `browser_wait_for({ time: 5 })`
2. 截图查看实际页面: `browser_take_screenshot()`
3. 检查 UI Server 日志是否有错误

### 问题 2: 点击 Submit 后无响应

**症状**: 点击按钮后，日志中没有任何输出。

**可能原因**:
- 按钮 ref 错误
- UI 事件处理逻辑异常

**解决**:
1. 确认 ref 是否正确（重新 snapshot）
2. 检查浏览器控制台: `browser_console_messages({ level: "error" })`
3. 检查 UI Server 日志是否收到 POST /ui_event

### 问题 3: UI Server 发送 Matrix 消息失败

**症状**: UI Server 日志显示 `[forward_ui_events] Matrix send failed`。

**可能原因**:
- Matrix client 未初始化
- 网络问题

**解决**:
1. 重启 UI Server
2. 检查 .env 配置是否正确
3. 测试 Matrix homeserver 连接: `curl -k https://matrix.localhost/_matrix/client/versions`

### 问题 4: MBR Worker 没有收到 Matrix 消息

**症状**: UI Server 发送成功，但 MBR Worker 无日志输出。

**可能原因**:
- MBR 未连接到 Matrix
- 不在同一个 DM room

**解决**:
1. 检查 MBR Worker 启动日志，确认 `Matrix client ready`
2. 确认 MBR 已加入房间 `!rvgIBRtgXATQGGRWiS:localhost`
3. 重启 MBR Worker

## 成功标准

步骤 0（Playwright 测试）成功的标志：

- ✅ Playwright 成功导航到 UI
- ✅ 成功定位并操作输入框和按钮
- ✅ UI Server 日志显示 Matrix 消息发送成功
- ✅ MBR Worker 日志显示收到消息并转发到 MQTT
- ✅ 没有错误日志

**只有步骤 0 成功后，才能继续步骤 5（K8s 部署）**。

## 参考示例

### 完整测试流程（伪代码）

```javascript
// 1. 导航
browser_navigate({ url: "http://127.0.0.1:9000" })

// 2. 等待加载
browser_wait_for({ time: 3 })

// 3. 获取页面结构
const snapshot = browser_snapshot()
// 从 snapshot 中找到：
// - 颜色输入框的 ref (假设是 "input-color-ref")
// - Submit 按钮的 ref (假设是 "btn-submit-ref")

// 4. 输入颜色
browser_type({
  ref: "input-color-ref",
  text: "#ff00ff",
  element: "Color input"
})

// 5. 点击按钮
browser_click({
  ref: "btn-submit-ref",
  element: "Submit button"
})

// 6. 等待处理
browser_wait_for({ time: 2 })

// 7. 截图验证
browser_take_screenshot({
  filename: "test_result.png"
})

// 8. 检查控制台
browser_console_messages({ level: "error" })

// 9. 检查网络请求（可选）
browser_network_requests({ includeStatic: false })
```

## 相关文档

- **完整任务文档**: `docs/handover/k8s_remote_worker_deployment.md`
- **当前状态摘要**: `docs/handover/CURRENT_STATE.md`
- **架构说明**: `docs/ssot/ui_to_matrix_event_flow.md`

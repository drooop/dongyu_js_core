# 交接给 OpenCode 指引

## 📋 任务文档位置

**快速开始**: `docs/handover/CURRENT_STATE.md` ⭐ 推荐先看这个
- 当前进度摘要（步骤 1-4 已完成）
- 已创建文件清单
- 待完成任务概览（步骤 0 + 步骤 5）
- 快速参考命令

**完整文档**: `docs/handover/k8s_remote_worker_deployment.md`
- 完整的背景说明
- 所有步骤的详细内容（步骤 0-5）
- 服务管理（启动/停止/重启）
- 故障排查指南
- 验证成功的标准

**Playwright 测试指南**: `docs/handover/PLAYWRIGHT_TEST_GUIDE.md` 🎭
- 如何使用 Playwright 复现测试
- 详细的操作步骤
- 常见问题和故障排查
- 成功标准

---

## 💬 如何与 OpenCode 交流

### ⚠️ 当前状态 (2026-02-04 更新)

**已完成的工作**:
- ✅ 步骤 1-4 已完成（所有文件已创建）
- ✅ 程序模型配置、Worker 脚本、Dockerfile、K8s 资源文件全部就绪
- ✅ 基础链路（UI → Matrix → MBR → MQTT）已由 Claude 验证可用

**OpenCode 需要做的**:
- 🔄 **步骤 0**: 启动服务并使用 Playwright 复现测试（验证基础链路）
- 🔄 **步骤 5**: 部署到 K8s 并测试完整链路

---

### 方式 1: 直接指向文档（推荐）

```
请阅读 docs/handover/CURRENT_STATE.md 了解当前状态，然后按照 docs/handover/k8s_remote_worker_deployment.md 执行任务。

重要说明：
1. 步骤 1-4 已完成（所有配置文件已创建）
2. 请从"步骤 0: 启动服务并验证基础链路"开始
3. 步骤 0 需要使用 Playwright 复现之前的测试
4. 完成步骤 0 后，继续"步骤 5: K8s 部署和测试"

文档中包含完整的命令、验证方法和故障排查指南。
```

### 方式 2: 简化版（如果需要更明确）

```
任务：在本地 K8s (Docker Desktop) 中部署一个远端软件工人并跑通完整链路

当前状态：
- 步骤 1-4 已完成：所有配置文件、脚本、Dockerfile 和 K8s 资源已创建 ✅
- 基础链路 UI → Matrix → MBR → MQTT 已由 Claude 验证可用 ✅
- 待完成：OpenCode 启动服务、复现测试、部署到 K8s 🔄

详细文档：docs/handover/k8s_remote_worker_deployment.md

请按顺序执行：

**步骤 0: 启动服务并验证**
1. 停止现有后台服务（如果存在）
2. 启动 UI Server 和 MBR Worker
3. 使用 Playwright 复现测试（修改颜色 → 点击 Submit）
4. 验证日志中显示 Matrix 和 MQTT 消息成功

**步骤 5: K8s 部署和测试**
1. 确认 K8s 集群和 MQTT broker 可用
2. 构建 Docker 镜像
3. 部署到 K8s
4. 触发 UI 测试并验证 Remote Worker 日志
5. 确认完整链路畅通
```

### 方式 3: 分步执行（如果 OpenCode 需要更多指导）

```
请先阅读 docs/handover/CURRENT_STATE.md 了解当前状态。

然后执行步骤 0（启动服务并验证）：

1. 停止现有后台服务：
   lsof -ti:9000 | xargs kill -9 2>/dev/null
   pkill -f run_worker_mbr_v0.mjs

2. 启动 UI Server（后台）：
   bun packages/ui-model-demo-server/server.mjs --port 9000 &

3. 启动 MBR Worker（后台）：
   node scripts/run_worker_mbr_v0.mjs &

4. 使用 Playwright 测试 UI 交互：
   - 导航到 http://127.0.0.1:9000
   - 修改颜色输入框
   - 点击 Submit 按钮
   - 验证日志输出

完成步骤 0 并确认基础链路畅通后，告诉我结果，然后我们继续步骤 5。
```

---

## ⚠️ 重要提示

### OpenCode 需要知道的关键信息

1. **不要重启现有服务**
   - UI Server 和 MBR Worker 已在后台运行
   - 使用 `/tasks` 命令可以查看它们的状态

2. **遵循项目规范**
   - 项目遵循 `AGENTS.md` 和 `docs/WORKFLOW.md`
   - 所有 patch 操作遵循 `docs/ssot/mt_v0_patch_ops.md`

3. **验证方法很重要**
   - 每个步骤完成后，按照文档验证
   - 最终验证标准在文档末尾

4. **故障排查**
   - 文档包含 4 个常见问题的解决方案
   - 如果遇到其他问题，查看相关日志

---

## 🎯 预期结果

任务完成后，应该能看到：

```
浏览器点击 Submit
    ↓
UI Server 发送 Matrix 消息
    ↓
MBR Worker 转发到 MQTT
    ↓
K8s Remote Worker 接收并处理 ✅
    ↓
日志显示: "[remote_worker] Event processed successfully"
```

---

## 📚 参考文档（如 OpenCode 需要更多背景）

- **架构总览**: `docs/ssot/ui_to_matrix_event_flow.md`
- **用户配置**: `docs/user-guide/ui_event_matrix_mqtt_configuration.md`
- **Patch 规范**: `docs/ssot/mt_v0_patch_ops.md`
- **项目规范**: `AGENTS.md`, `docs/WORKFLOW.md`

---

## 🤝 交接完成检查清单

OpenCode 在开始前应确认：
- [ ] 已阅读快速开始文档 `CURRENT_STATE.md`
- [ ] 已阅读完整文档 `k8s_remote_worker_deployment.md`
- [ ] 理解任务目标（启动服务 → 验证基础链路 → 部署 K8s Worker → 跑通完整 E2E）
- [ ] 知道从哪一步开始（**步骤 0: 启动服务并验证**，步骤 1-4 已完成）
- [ ] 了解 Playwright 工具的使用（复现测试需要）

OpenCode 完成任务后应确认：
- [x] 步骤 1-4 已完成（由 Claude 完成）
- [ ] 步骤 0 已完成（服务启动 + Playwright 测试 + 基础链路验证）
  - [ ] UI Server 和 MBR Worker 正常运行
  - [ ] Playwright 成功模拟用户操作
  - [ ] UI → Matrix → MQTT 链路日志正常
- [ ] 步骤 5 已完成（K8s 部署和测试）
  - [ ] Docker 镜像构建成功
  - [ ] K8s Pod 正常运行 (`kubectl get pods -l app=remote-worker`)
  - [ ] Remote Worker 日志显示 MQTT 连接成功
  - [ ] E2E 测试通过（UI 点击 → K8s Worker 收到消息）
- [ ] 验证成功标准全部满足（文档末尾）

---
title: "Slide UI Evidence Runbook"
doc_type: user-guide
status: active
updated: 2026-04-21
source: ai
---

# Slide UI Evidence Runbook

## 用途

这页定义 `0291` 的最小证据包。

目标不是做一次性的“看起来可以”，而是让任何人都能按同一套入口重复验证：

- Gallery 展示存在
- Workspace 主线存在
- zip 导入可用
- 填表创建可用

## 本地入口

- Gallery
  - `http://127.0.0.1:30900/#/gallery`
- Workspace
  - `http://127.0.0.1:30900/#/workspace`

## 远端入口

- Gallery
  - `https://app.dongyudigital.com/#/gallery`
- Workspace
  - `https://app.dongyudigital.com/#/workspace`

## 本地最小证据

### A. Gallery

1. 打开本地 Gallery。
2. 确认页面里有 `0291 Slide UI Mainline Showcase`。
3. 确认卡片里能看到：
   - 主线摘要
   - 当前 slide app 数量
   - 当前 creator 状态
   - 本地与远端证据说明

### B. Workspace

1. 打开本地 Workspace。
2. 确认侧边栏里有：
   - `滑动 APP 导入`
   - `滑动 APP 创建`
3. 打开 `滑动 APP 创建`。
4. 新建一个临时 app。
5. 确认新 app 自动出现并自动打开。
6. 在新 app 里继续编辑文字。
7. 删除这个临时 app。
8. 确认它从侧边栏消失。

### C. zip 导入

1. 打开 `滑动 APP 导入`。
2. 上传一个有效 zip。
3. 确认导入 app 出现在侧边栏。
4. 打开后确认可继续使用。
5. 删除该导入 app。

## 远端最小证据

### 前置

远端验证前，应先把当前 `dev` 部署到 cloud。

典型顺序：

```bash
bash scripts/ops/remote_preflight_guard.sh
bash scripts/ops/sync_cloud_source.sh --ssh-user drop --ssh-host 124.71.43.80 --remote-repo /home/wwpic/dongyuapp --remote-repo-owner wwpic --revision \"$(git rev-parse --short HEAD)\"
ssh drop@124.71.43.80 'sudo -n bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_full.sh --rebuild'
```

### A. 远端 Gallery

1. 打开远端 Gallery。
2. 确认 `0291 Slide UI Mainline Showcase` 可见。
3. 确认卡片里能读到当前 Slide UI 主线摘要。

### B. 远端 Workspace

1. 打开远端 Workspace。
2. 确认 `滑动 APP 导入` 与 `滑动 APP 创建` 都存在。
3. 用 creator 创建一个临时 app。
4. 确认它能自动出现、自动打开、可继续编辑。
5. 删除这个临时 app，确认它消失。

## 记录建议

每次取证至少记录这些事实：

- 使用的是本地还是远端入口
- 访问的是 Gallery 还是 Workspace
- 是否看到了 slide showcase
- 是否跑通了 create / open / edit / delete
- 如果有临时 app，是否已清理

## 不算完成的情况

以下情况都不能算 `0291` 通过：

- 只有文档，没有 Gallery 正式展示面
- 只有 Gallery 卡片，没有 Workspace 真操作
- 只做本地，不做远端
- 远端验证后留下未清理的临时 app

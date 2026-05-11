---
title: "Cloud Public Docs Fast Deploy"
doc_type: deployment
status: active
updated: 2026-05-12
source: ai
---

# Cloud Public Docs Fast Deploy

本页说明只发布公开文档和静态 HTML 时的远端快速部署路径。

适用场景：
- 只改 `docs/user-guide/slide-app-runtime/*.md` 或 `*.html`。
- 需要把 `minimal_submit_app_provider_interactive.html` 发布到远端 Static 项目。
- 不需要重建 UI Server 镜像，不需要重启 K8s workload。

不适用场景：
- 改了 `packages/**`、`deploy/sys-v1ns/**`、`k8s/**`。
- 改动需要容器内源码哈希 gate 或 rollout 验证。
- 需要变更 runtime、worker、MBR、Matrix/MQTT 配置。

## 推荐命令

在本地仓库根目录执行：

```bash
bash scripts/ops/deploy_cloud_public_docs_fast.sh \
  --ssh-user drop \
  --ssh-host dongyudigital.com \
  --remote-repo /home/wwpic/dongyuapp \
  --remote-repo-owner wwpic \
  --revision "$(git rev-parse --short HEAD)"
```

## 过程

1. 本地脚本先调用 `sync_cloud_source.sh`，将指定 revision 同步到远端仓库 `/home/wwpic/dongyuapp`。
2. 远端脚本检查 `.deploy-source-revision` 或远端 git HEAD，确保远端源码确实是本次 revision。
3. 远端执行 `scripts/ops/sync_ui_public_docs.sh`，只复制公开文档和 Static 项目文件。
4. 不执行 Docker build。
5. 不导入 rke2 containerd image。
6. 不触发 `kubectl rollout restart`。

## 远端落点

Markdown 文档落点：

```text
/home/wwpic/dongyu/volume/persist/ui-server/docs/user-guide/slide-app-runtime/
```

交互式 HTML 落点：

```text
/home/wwpic/dongyu/volume/persist/ui-server/static_projects/slide-app-runtime-minimal-submit-provider/index.html
/home/wwpic/dongyu/volume/persist/ui-server/static_projects/slide-app-runtime-minimal-submit-provider/minimal_submit_app_provider_interactive.html
```

公网访问地址：

```text
https://app.dongyudigital.com/p/slide-app-runtime-minimal-submit-provider/
https://app.dongyudigital.com/p/slide-app-runtime-minimal-submit-provider/minimal_submit_app_provider_interactive.html
```

## PASS 判定

- 脚本输出 `Cloud public docs fast deploy complete`。
- 脚本输出远端 `minimal_submit_app_provider_interactive.html` 的 sha256。
- `curl` 访问上述两个公网 URL 返回 `200`。
- Playwright 打开交互式 HTML 后，能看到 `提交按钮` 页签和 `Submit 类提交按钮如何准备模型表` 内容。

## 为什么更快

标准 `deploy_cloud_app.sh --target ui-server` 会同步资产、构建镜像、导入镜像、重启 deployment，并做容器源码哈希 gate。只改公开文档时，这些步骤不会改变运行时代码，属于额外开销。

本 fast path 只做两件事：
- 让远端仓库记录当前 revision。
- 把公开文档复制到 UI Server 已挂载的 persisted docs/static 目录。

这样可以把 docs/static-only 发布从“镜像发布”缩小为“文件同步 + 公网验证”。

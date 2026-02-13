# rke2 集群故障诊断与恢复方案

**日期**: 2026-02-13
**诊断人**: Claude (AI)
**服务器**: 124.71.43.80 (aPIC-XC599-dongyu), user=wwpic
**集群**: rke2 v1.34.1, 单节点, etcd v3.6.4

---

## 1. 故障概述

rke2-server 进程 (pid=154794) 处于 active 但 **功能失效** 状态:
- etcd (2379): **不可达** — connection refused
- kube-apiserver (6443): **不可达** — 未启动
- kubelet (10250): 运行中
- supervisor (9345): 运行中

集群自 2026-02-12 23:01 起无法提供 API 服务, `kubectl` 命令全部 connection refused.

## 2. 根因分析

### 2.1 直接原因

rke2 启动后检测到 **本节点不在 etcd 集群成员列表中**:

```
Feb 12 23:02:39 level=info msg="Local Node deleted or removed from etcd cluster, cleaning up server static pods"
```

rke2 随即清理了 etcd 和 kube-apiserver 的 static pod, 导致两个核心组件停止,
之后 etcd 2379 端口永久 connection refused, 进入死循环.

### 2.2 间接原因 (需要确认)

2026-02-12 早些时候, 在该服务器上误启动了 k3s 服务.
k3s 的 containerd 与 rke2 的 containerd 争夺端口 10010, 导致 rke2-server 崩溃.
同事已停止 k3s 并重启 rke2, 但 etcd 数据中的 node 记录可能在混乱期间被损坏或删除.

### 2.3 启动时间线 (第二次重启, 当前进程)

| 时间 | 事件 |
|------|------|
| 23:01:36 | rke2-server 由 systemd 重新启动 (pid=154794) |
| 23:01:37 | 临时 etcd 启动成功 (2399/2400), 数据一致性检查通过 |
| 23:01:39 | 临时 etcd 关闭, 数据 reconcile 完成 |
| 23:02:26 | kubelet 启动, 尝试启动正式 etcd (2379) |
| 23:02:36 | "ETCD server is now running" — etcd 短暂可用 |
| 23:02:38 | kube-apiserver readyz 检查: rbac/apiservice 控制器未就绪 |
| **23:02:39** | **"Local Node deleted or removed from etcd cluster, cleaning up server static pods"** |
| 23:02:42 | remotedialer EOF |
| 23:02:56+ | etcd 2379 永久 connection refused, 死循环 |

## 3. 服务器当前状态

### 3.1 进程

- rke2 主进程: 运行 (pid=154794), 但卡在 etcd learner management 重试循环
- kubelet: 运行 (pid=155223)
- containerd-shim: 7 个残留进程 (k8s.io namespace)
- kube-apiserver: **未运行**
- etcd: **未运行** (仅临时 etcd 短暂运行后关闭)
- k3s: inactive, disabled

### 3.2 关键路径

| 项目 | 路径 |
|------|------|
| rke2 data-dir | `/opt/wwPic/runtime/` |
| etcd 数据 | `/opt/wwPic/runtime/server/db/etcd/` |
| etcd 快照 | `/opt/wwPic/runtime/server/db/snapshots/` |
| static pod manifests | `/opt/wwPic/runtime/server/manifests/` |
| rke2 kubeconfig | `/opt/wwPic/runtime/server/cred/rke2.kubeconfig` (待确认) |
| rke2 config | `/etc/rancher/rke2/config.yaml` |
| rke2 服务定义 | `/usr/local/lib/systemd/system/rke2-server.service` |
| kubelet kubeconfig | `/opt/wwPic/runtime/agent/kubelet.kubeconfig` |
| etcd node name | `apic-xc599-dongyu-5e3ecaca` |

### 3.3 rke2 配置 (/etc/rancher/rke2/config.yaml)

```yaml
token: dongyu-wwpic-i3s-token-2026
data-dir: /opt/wwPic/runtime
cni:
  - multus
  - cilium
disable-kube-proxy: true
profile: cis
selinux: true
write-kubeconfig-mode: "0600"
kubelet-arg:
  - "root-dir=/opt/wwPic/runtime/kubelet"
  - "max-pods=200"
  - "system-reserved=memory=1Gi"
  - "protect-kernel-defaults=true"
etcd-snapshot-schedule-cron: "0 2 * * *"
etcd-snapshot-retention: 7
```

### 3.4 可用 etcd 快照

| 文件 | 日期 | 大小 |
|------|------|------|
| etcd-snapshot-apic-xc599-dongyu-1770832805 | Feb 12 02:00 | 22MB |
| etcd-snapshot-apic-xc599-dongyu-1770746405 | Feb 11 02:00 | 22MB |
| etcd-snapshot-apic-xc599-dongyu-1770660002 | Feb 10 02:00 | 17MB |
| etcd-snapshot-apic-xc599-dongyu-1770573603 | Feb 9 02:00 | 17MB |
| etcd-snapshot-apic-xc599-dongyu-1770487202 | Feb 8 02:00 | 17MB |
| etcd-snapshot-apic-xc599-dongyu-1770400803 | Feb 7 02:00 | 17MB |

**推荐**: 使用 Feb 12 02:00 快照 (故障发生前最近的快照).
注意: Feb 11-12 快照明显大于之前 (22MB vs 17MB), 可能包含了之前 k3s 误操作注入的数据.
如果 Feb 12 恢复后仍异常, 可尝试 Feb 10 快照.

## 4. 恢复方案

### 方案 A: 从 etcd 快照恢复 (推荐)

```bash
# 1. 停止 rke2
sudo systemctl stop rke2-server

# 2. 确认 rke2 完全停止
sudo ps aux | grep -E 'rke2|etcd|kube-api' | grep -v grep

# 3. 从最近快照恢复 (cluster-reset 会重建单节点集群)
sudo rke2 server \
  --cluster-reset \
  --cluster-reset-restore-path=/opt/wwPic/runtime/server/db/snapshots/etcd-snapshot-apic-xc599-dongyu-1770832805

# 4. 等待恢复完成 (输出 "Managed etcd cluster membership has been reset" 即成功)
# 5. Ctrl+C 停止前台进程

# 6. 重启 rke2 服务
sudo systemctl start rke2-server

# 7. 等待约 1-2 分钟, 检查
sudo KUBECONFIG=/opt/wwPic/runtime/server/cred/rke2.kubeconfig kubectl get nodes
sudo KUBECONFIG=/opt/wwPic/runtime/server/cred/rke2.kubeconfig kubectl get pods -A
```

**回滚**: 如果恢复失败, 原始 etcd 数据仍在 `/opt/wwPic/runtime/server/db/etcd/`,
`--cluster-reset` 会把旧数据移到 `/opt/wwPic/runtime/server/db/etcd-old-<timestamp>/`.

### 方案 B: 强制集群重置 (不用快照)

```bash
# 不从快照恢复, 直接重置集群成员 (保留当前 etcd 数据)
sudo systemctl stop rke2-server
sudo rke2 server --cluster-reset
# Ctrl+C after "reset" message
sudo systemctl start rke2-server
```

**风险**: 当前 etcd 数据可能已包含损坏的 node 记录, 重置后可能仍然异常.

### 方案 C: 完全重建 (最后手段)

```bash
# 删除 etcd 数据, 从零开始
sudo systemctl stop rke2-server
sudo rm -rf /opt/wwPic/runtime/server/db/etcd/
# (保留 snapshots/ 目录以备后用)
sudo systemctl start rke2-server
```

**影响**: 所有 K8s 对象 (deployments, services, configmaps, secrets, CRDs) 全部丢失.
对于本项目来说, 因为所有 K8s 对象本来就需要重新部署, 所以损失可控.

## 5. 需要清理的遗留物

以下是之前 k3s 误操作遗留在服务器上的文件, 恢复集群后建议清理:

### 5.1 k3s 相关文件 (AI 操作遗留)

| 文件 | 说明 | 操作建议 |
|------|------|----------|
| `/etc/rancher/k3s/config.yaml` | AI 创建的 k3s 配置 (disable-network-policy) | 删除 |
| `/etc/rancher/k3s/k3s.yaml` | k3s 生成的 kubeconfig | 删除 |
| `/etc/rancher/k3s/registries.yaml` | AI 创建的镜像源配置 | 删除 |
| `/var/lib/rancher/k3s/` | k3s 数据目录 (agent/data/server) | 确认无用后删除 |
| `/usr/local/bin/k3s` | k3s 二进制 (原本就存在, 非 AI 安装) | 保留或由管理员决定 |

### 5.2 CNI 配置 (AI 操作遗留)

| 文件 | 说明 |
|------|------|
| `/etc/cni/net.d/00-multus.conf.cilium_bak` | AI 重命名的 multus 配置 |
| `/etc/cni/net.d/00-multus.conflist.cilium_bak` | AI 重命名的 multus conflist |
| `/etc/cni/net.d/05-cilium.conf.cilium_bak` | AI 重命名的 cilium 配置 |
| `/etc/cni/net.d/05-cilium.conflist.disabled` | AI 重命名的 cilium conflist |
| `/etc/cni/net.d/10-flannel.conflist.cilium_bak` | AI 创建后重命名的 flannel 配置 |

**建议**: 恢复集群后, rke2 会自动管理 CNI 配置. 先确认集群正常后, 再清理 `*_bak` 和 `*.disabled` 文件.

### 5.3 k3s 通过 kubectl 部署的资源 (已丢失)

以下资源部署在 k3s 集群上, 不会存在于 rke2 集群中, 无需清理:
- cert-manager (namespace: cert-manager)
- EMQX MQTT broker (namespace: default)
- Synapse Matrix server (未完成部署)

## 6. 恢复后下一步

集群恢复正常后, 重新执行部署计划:

1. 确认 `kubectl get nodes` 显示 Ready
2. 确认 rke2 自带的 ingress-nginx / cilium / coredns 正常
3. 安装 cert-manager + ClusterIssuer (Let's Encrypt)
4. 部署 EMQX MQTT broker
5. 部署 Matrix/Synapse
6. 构建并部署 Remote Worker + MBR Worker + UI Server
7. 配置 Ingress TLS (app.dongyudigital.com)
8. 端到端验证

## 7. 经验教训

1. **永远不要在 rke2 服务器上启动 k3s** — 两者的 containerd 争夺端口 10010, 会导致彼此崩溃
2. **不要 flush iptables** — 可能切断 SSH 连接
3. **操作前必须确认集群类型** — rke2 和 k3s 路径不同、配置不同、二进制不同
4. **远程操作必须有回滚方案** — 尤其是涉及网络和集群基础设施的操作

---
title: "0322 — imported-slide-app-host-egress-test-app Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0322-imported-slide-app-host-egress-test-app
id: 0322-imported-slide-app-host-egress-test-app
phase: phase1
---

# 0322 — imported-slide-app-host-egress-test-app Plan

## Goal

- 落一个真正可导入的 slide app 测试包，验证 imported app 不只具备宿主 ingress，还能在安装后通过宿主补的 egress adapter 继续进入 `Model 0` 正式外发链，并最终触达 `pin.bus.out / MQTT / Matrix`。

## Scope

- In scope:
  - imported app 最小测试 payload / zip
  - imported app root 上的宿主 ingress 声明
  - imported app root 上的宿主 egress 声明或等价最小声明
  - 安装后宿主自动生成：
    - `Model 0 -> imported app` ingress route
    - imported app -> `Model 0` egress relay
    - `Model 0` 上的 `pin.bus.out` / Matrix forward bridge
  - contract + server-flow tests
  - authoritative docs 与 user/handover docs 同步
- Out of scope:
  - 不放开 imported zip 自带 `pin.bus.out`
  - 不泛化到多 semantic / 多 boundary
  - 不扩展到非 `submit`
  - 不改现有 direct-pin UI 主线

## Invariants / Constraints

- imported zip 仍不得自带：
  - `pin.bus.in`
  - `pin.bus.out`
  - `pin.connect.model`
  - `func.python`
- imported app 不得依赖未来安装后的实际 `model_id`。
- imported app 的页面内按钮链不是主验收，只作辅助验证。
- 主验收必须覆盖 3 段：
  - 宿主入口
  - imported app 内部整理
  - 宿主正式外发
- `pin.bus.out` 仍只允许位于 `Model 0 (0,0,0)`。
- Matrix 发送仍由宿主系统函数执行；正数 imported app 的 `func.js` 不直接承担 `sendMatrix()`。

## Success Criteria

1. 一个新的 imported slide app zip 可以被导入，并拿到新分配的 `model_id`。
2. zip 内自带的程序模型与处理链会一起落进 runtime。
3. 宿主可以通过 imported app 声明的入口把正式 `submit` 事件打进该 app。
4. app 自己的程序模型能把输入整理成临时模型表 payload。
5. 宿主自动补的 egress adapter 能把该 payload 接到 `Model 0` 的正式外发链。
6. 真实验证里必须同时看到：
  - `Model 0 pin.bus.out`
  - MQTT mock publish
  - Matrix publish 调用
7. imported app 删除后，宿主自动补的 ingress / egress labels、mount relay 与 forward bridge 不留残件。

## Inputs

- Created at: `2026-04-16`
- Iteration ID: `0322-imported-slide-app-host-egress-test-app`
- Depends on:
  - `0320-imported-slide-app-host-ingress-semantics-freeze`
  - `0321-imported-slide-app-host-ingress-implementation`

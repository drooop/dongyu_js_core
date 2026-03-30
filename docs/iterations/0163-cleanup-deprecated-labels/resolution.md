---
title: "0163 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0163-cleanup-deprecated-labels
id: 0163-cleanup-deprecated-labels
phase: phase1
---

# 0163 — Resolution (HOW)

## 0. Strategy

先做最小 runtime 清理，再做受影响测试对齐，最后执行 grep 与显式清单复核。

## 1. Steps

| Step | Scope | Files | Verify |
|---|---|---|---|
| 1 | 移除 runtime 兼容分支并切换 table/single pin 语义 | `packages/worker-base/src/runtime.mjs` | 单测清单可执行 |
| 2 | 同步 server/config/脚本口径 | `packages/ui-model-demo-server/server.mjs`, `packages/worker-base/system-models/server_config.json`, `scripts/tests/*.mjs` | 受影响用例 PASS |
| 2.1 | `validate_program_model_loader_v0` 新口径修复 | `scripts/validate_program_model_loader_v0.mjs` | `connect_allowlist` 改为 `pin.connect.*` 路由断言后 PASS |
| 3 | ui-server 认证隔离（drop 与 mbr） | `k8s/local/workers.yaml`, `k8s/cloud/workers.yaml`, `scripts/ops/start_local_ui_server_k8s_matrix.sh` | deployment env 不含 `MATRIX_MBR_BOT_ACCESS_TOKEN` |
| 4 | 零残留门控 | `packages/ deploy/ scripts/` | grep 4 条为 0 |
| 5 | 归档与状态更新 | `docs/iterations/0163.../*`, `docs/ITERATIONS.md` | 结果可复现 |

## 2. Verification Commands

1. `rg -n --glob '*.js' --glob '*.mjs' --glob '*.json' --glob '!**/dist/**' --glob '!**/*.legacy.json' --glob '!**/*.legacy.mjs' -e '"CELL_CONNECT"' -e '"cell_connection"' -e '"BUS_IN"' -e '"BUS_OUT"' -e '"MODEL_IN"' -e '"MODEL_OUT"' -e '"subModel"' packages deploy scripts`
2. `rg -n --glob '*.json' --glob '!**/dist/**' --glob '!**/*.legacy.json' -e '"t"\s*:\s*"function"' packages deploy scripts`
3. `rg -n --glob '*.js' --glob '*.mjs' --glob '!**/dist/**' --glob '!**/*.legacy.mjs' -e "\.t\s*===\s*'function'" -e '\.t\s*===\s*"function"' packages scripts`
5. tests/validate 显式清单（与 0162 一致 + 0158 新增用例）。
6. Matrix validate（显式参数）：
   - `MATRIX_HOMESERVER_URL=http://192.168.194.216:8008`
   - `--matrix_room_id !sPvNeZvMXlixVcsJJC:localhost`
   - 推荐使用 `drop` token (`MATRIX_MBR_ACCESS_TOKEN`) 规避密码登录限流

## 3. Gate Notes

- 分支要求：`dev_0163-cleanup-deprecated-labels`（禁含 `-ft-`）。
- 若外部依赖脚本因环境缺失失败，需在 runlog 标注为环境前置，不得伪造 PASS。

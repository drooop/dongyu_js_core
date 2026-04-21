---
title: "0156 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0156-ui-renderer-component-registry
id: 0156-ui-renderer-component-registry
phase: phase1
---

# 0156 — Resolution (HOW)

## 0. Execution Strategy

采用“测试先行 + 分层替换”策略：

1. 先补 registry/upload 失败用例（RED）。
2. 再改 renderer 与 validator 主体（GREEN）。
3. 最后迁移 static upload 与 server auth/media（GREEN+回归）。

## 1. Step Overview

| Step | Title | Scope | Files | Verification | Acceptance | Rollback |
|---|---|---|---|---|---|---|
| 1 | Iteration gate + docs | 0156 目录与索引登记 | `docs/ITERATIONS.md`, `docs/iterations/0156-*/` | 索引可查到 0156 | gate 合规 | 回退 docs |
| 2 | RED tests | 新增 registry/upload 失败用例 | `scripts/validate_ui_renderer_v0.mjs`, `scripts/validate_ui_ast_v0x.mjs`, fixtures | 新用例先 FAIL | 失败原因正确 | 回退测试 |
| 3 | Renderer registry-first | 全 type 走 registry，不再按 node.type if/switch | `packages/ui-renderer/src/renderer.mjs`, `renderer.js`, `component_registry_v1.json` | renderer suites PASS | no directUpload path | 回退 renderer |
| 4 | AST validator dynamic types | type 集合从 registry 动态读取 | `scripts/validate_ui_ast_v0x.mjs` | ast suite PASS | 无固定 NODE_TYPES | 回退 validator |
| 5 | Static page migration | FileInput->upload_media->mxc:// + static_project_upload action | `packages/ui-model-demo-frontend/src/demo_modeltable.js`, stores | static 交互闭环 | 无 directUpload props | 回退 frontend |
| 6 | Server media + auth session token | 新增 media upload，删除 /api/static/upload，静态上传改 mxc 下载 | `packages/ui-model-demo-server/auth.mjs`, `server.mjs`, `packages/worker-base/system-models/intent_handlers_static.json` | e2e/policy scripts PASS | static_project_upload 走 mxc | 回退 server/system-models |
| 7 | Final regression + runlog | 汇总验证与证据 | `docs/iterations/0156-*/runlog.md` | 命令可复跑 | PASS/FAIL 可裁决 | 补充修复后重跑 |

## 2. Planned Verification Commands

1. `node scripts/validate_ui_renderer_v0.mjs --case all --env jsdom`
2. `node scripts/validate_ui_ast_v0x.mjs --case all`
3. `npm -C packages/ui-model-demo-frontend run test`
4. `npm -C packages/ui-model-demo-frontend run build`

（如新增专项验证脚本，写入 runlog 的命令与关键输出。）

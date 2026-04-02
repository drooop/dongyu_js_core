---
title: "Non-Three Fine-Grain Audit"
doc_type: note
status: active
updated: 2026-04-03
source: ai
---

# Non-Three Fine-Grain Audit

## 一句话结论

排除 Three.js 后，`workspace_positive_models.json` 仍然是“细粒度 label 为主”，但还残留少量偏粗的 `ui_props_json / ui_bind_json / func.js / 汇总状态`。

## 最重要的判断

- 主体结构是细粒度的
- 没有退回整页 `page_asset_v0`
- 下一轮不该重写整份文件，而是做“定点拆粗块”

## 推荐收口顺序

1. `0270`
2. `0276`
3. `Static`
4. `ws_apps_registry`

# dongyu_js_core

## 项目知识库入口

- 执行约束与导航：`AGENTS.md`
- 运行与迭代文档：`docs/`（仓库内权威源；vault 路径 `~/Documents/drip/Projects/dongyuapp` 指向这里）
- 运维一键命令（本次新增并要求持续维护）：`scripts/ops/README.md`

## Model 100 OrbStack pod 闭环命令

```bash
bash scripts/ops/ensure_runtime_baseline.sh \
&& bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url http://127.0.0.1:30900
```

## 0154 LLM 路由一键命令

```bash
bash scripts/ops/run_0154_llm_dispatch_local.sh
```

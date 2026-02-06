> ⚠️ IMMUTABLE FILE / 执行宪法
>
> 本文件是仓库的最高级执行规范（Execution Constitution）。
> - 未经用户明确指示，任何 AI / Agent 不得修改、重写、精简、合并或删除本文件的任何内容。
> - 若发现需要调整，只能提出修改建议，不得直接修改文件。
> - 本仓库关于云海流/软件工人/工作区/总线等概念，以 `docs/architecture_mantanet_and_workers.md` 为唯一事实来源（SSOT）。任何方案与实现不得与其冲突。

# Repository Guidelines (AGENTS.md)

本文件用于约束 Codex/协作者在本仓库中的行为：目录职责、命令与验证、术语定义、不变量、安全与配置、以及迭代工作流入口。

---

## 0. Core Principles

- **Concept-First（概念先行）**：术语与不变量先统一，再实现。
- **Single Source of Truth（唯一事实来源）**：
  - 架构概念（SSOT）：`docs/architecture_mantanet_and_workers.md`
  - 项目执行宪章（Charter，若存在）：`docs/charters/*.md`（优先级低于 SSOT、高于任意 iteration plan）
  - 工作流：`docs/WORKFLOW.md` 与 `docs/ITERATIONS.md`
  - 当前迭代协议：`docs/iterations/<id>/plan.md` 与 `resolution.md`
- **Verification-First（可验证优先）**：任何改动必须配套可执行验证（脚本/命令/检查清单）。
- **No UI-Only Validation（禁止仅靠 GUI 验证）**：验证必须可复现、可自动化，避免“我点过了所以没问题”。
- **Behavior-Oracle First（行为真值优先）**：
  - 本仓库存在 Python 参照实现（PICtest）。其地位是**行为 Oracle**，不是 SSOT。
  - 在不违反 SSOT/Charter 的前提下：**实现应以 PICtest 的可观测行为为准**，而不是凭空推导。

---

## 1. Domain Glossary（项目术语与定义）

> 本节用于沉淀项目内稳定术语。新增术语必须在此补充“定义/边界/不变量”。

### 1.1 App-as-OS（小系统）
- **定义**：洞宇 APP 是一个“可运行/可安装能力模块与小应用”的小系统，而非单一业务 App。
- **不变量**：避免把某个单一业务（聊天/通话）写死成唯一主叙事；它们只是模块。

### 1.2 Software Worker Base（软件工人基座，JS 版）
- **定义**：由 ModelTable 驱动的执行基座（Bun/Elysia），负责解释/调度程序模型、流程模型、UI 模型等。
- **不变量**：
  - 完全替代 Python 版（不并行）。
  - 行为应对齐 PICtest（可观测行为对照），不追求内部结构相似。

### 1.3 ModelTable / Cell（模型表/单元格）
- **定义**：Cell 固定字段 `p/r/c/k/t/v`，用于表达 UI/状态/逻辑/触发等，由运行时解释执行。
- **不变量**：
  - ModelTable 是**显示与状态的唯一数据源**。
  - UI/渲染层不得持有“真值态”绕开 ModelTable。

### 1.4 Program Model Built-ins（程序模型内建 k）
- **定义**：程序模型触发/副作用由特殊的内建 `k` 关键字驱动（例如 `k:"value"`, `k:"pin_in"`, `k:"pin_out"`）。
- **不变量**：
  - 内建 `k` 的语义不得“拍脑袋设计”；必须先从 PICtest 提取行为证据表，再实现。

### 1.5 PIN_IN / PIN_OUT（控制总线针脚）
- **定义**：PIN_IN / PIN_OUT 是**明确的 Cell 类型**（例如 `k:"pin_in"` / `k:"pin_out"`）。
- **不变量**：
  - 第一阶段仅围绕控制总线语义实现：本地 docker MQTT 的 pub/sub + PIN_IN/OUT 行为闭环。
  - 未进入后续迭代前，不引入 Matrix/双总线。

### 1.6 Sliding UI（滑动 UI）与 UI AST
- **定义**：UI 模型解释为抽象组件树 AST，再由 Vue3 + Element Plus 作为 renderer 渲染。
- **不变量**：
  - UI 事件必须归一为“写格子”（写某个 Cell.v/value/event mailbox），UI 不得直接发总线消息。
  - 后续由程序模型触发器观察 Cell 变化，产生副作用。

### 1.7 管理总线 / 控制总线 / 工作区（Workspace）
- **定义**：管理总线（Matrix）与控制总线（MQTT）及 MBR、工作区隔离边界等概念以 SSOT 为准。
- **不变量**：第一阶段只做控制总线（MQTT），双总线在后续迭代引入。

---

## 2. Project Structure & Module Organization（新版洞宇 APP）

> 目录仅定义“职责”，不绑定实现细节。实际子目录名以仓库现状为准，但职责必须匹配。

- `packages/app-shell/`
  - 洞宇 APP 壳：账号/设置/应用管理/导航/本地 domain 的 UI 入口等
- `packages/worker-base/`
  - JS 软件工人基座：ModelTable runtime、程序模型 built-ins、流程/文档/UI 模型解释框架、PIN_IN/OUT + MQTT
- `packages/ui-renderer/`
  - UI AST 规范 + Vue3/Element Plus renderer（后续迭代）
- `packages/bus-adapters/`（可选，后续迭代）
  - Matrix/MBR/MQTT 双总线适配（第一阶段不要实现）
- `scripts/`
  - 自动化验证脚本（强制优先写脚本验收）
- `vendor/` 或 `vender/`
  - 参照实现与第三方代码（如 PICtest）。注意：路径必须统一，避免拼写分裂。

### 2.1 Directory Ownership Invariants（目录归属不变量）

- 先分类再落位：新增文件必须先确定职责归属（产品代码/部署资产/流程文档/测试资产），再落到对应目录。
- 根目录最小化：根目录仅承载仓库级入口与全局配置，禁止放置任务临时产物与测试导出。
- `docs/` 只承载规范、架构、流程、迭代文档与必要证据；不得作为测试数据或临时运行数据目录。
- 测试资产分层：
  - 可复用 fixture 放 `scripts/fixtures/` 或对应 package fixture 目录。
  - 本地测试输入/临时数据库/调试导出放 `test_files/` 或 package 局部临时目录，并保持可忽略（gitignored）策略。
- 运行时数据就近归属：工作区数据、持久化 DB 等应放在其主要消费者所在 package 目录，不跨域散落在根目录。
- 文件迁移必须同步更新文档、脚本与命令引用，确保验证链路可执行。

---

## 3. Reference Implementation (PICtest) Rules（必须遵守）

- PICtest 是行为 Oracle：用于提取 built-in `k`、触发器、PIN 行为的“可观测规则”。
- 每次涉及运行时语义的迭代（built-in k / triggers / pin）：
  - Phase0 必须定位 PICtest 中对应实现位置（文件路径 + 关键符号）
  - Phase1 必须产出“行为证据表”（输入/条件/输出副作用/错误/幂等）
  - Phase3 必须用脚本验证 JS 行为与证据表一致
- 若文档约定与 PICtest 行为冲突：
  - **优先 PICtest 行为**，除非它违反 SSOT 或明确的 Charter 禁止项。

---

## 4. Build, Test, and Development Commands（以本仓库现状为准）

- 本仓库可能包含前端/运行时/脚本多个 package。
- **禁止** AI 为了“验证”随意触发重度 build（桌面打包/移动打包等）。
- 验证优先级：
  1) `scripts/` 下的可重复脚本（单元/集成/冒烟）
  2) 轻量命令（lint/typecheck）
  3) 重度构建（仅在用户明确指示时）

> 注：旧仓库中的 pyservice、Tauri、Chaquopy 相关命令不适用于本仓库，除非本仓库明确存在并在 README/WORKFLOW 中声明。

---

## 5. Coding Style & Naming Conventions

- TypeScript：strict，2 空格缩进
- 组件命名 PascalCase，文件命名保持一致性
- UI：Vue3 + Element Plus + Tailwind，禁止在组件内散落 hardcode 颜色与间距（优先 token/变量）
- Runtime：Bun/Elysia，重要协议（MQTT payload/AST schema）必须版本化并有 schema（zod/json schema 任选其一，但需统一）

---

## 6. Security & Configuration

- secrets 不入库；使用 `.env`/密管系统
- MQTT 本地 docker 环境的连接参数必须可配置
- 若涉及 Matrix/Element Call（后续迭代）：账号/密钥策略必须在文档中写明，避免隐式依赖

---

## 7. Iteration Workflow Entry（工作流入口）

- 所有非紧急工作必须遵循：
  - `docs/WORKFLOW.md`
  - `docs/ITERATIONS.md`
- 当前迭代协议文件：
  - `docs/iterations/<id>/plan.md`
  - `docs/iterations/<id>/resolution.md`
  - `docs/iterations/<id>/runlog.md`

---

## 8. Agent Workflow Expectations（长期滚动工作）

- 重要决策必须写入 iteration 文档（plan/resolution/runlog），保持可审计。
- 遇到不确定语义：必须先回到 SSOT/Charter/PICtest 查证，不得猜。
- 回复用户使用中文，专有名词保留英文。

---

## 9. OpenCode / oh-my-opencode（skills 与仓库约定）

本仓库支持通过 oh-my-opencode/OpenCode 的 skills/commands 体系进行“可审计、可验证”的协作。

- 仓库技能索引（唯一 canonical）：`skills/README.md`
- OpenCode skills（自动加载）：`.opencode/skills/*/SKILL.md`
- Legacy/compat skills（历史兼容）：`.codex/skills/*/SKILL.md`
- AI 工作约定（角色/Review Gate/证据）：`docs/ai-work-conventions.md`

约定：
- `doit` / `doit-auto` 的 `.opencode/skills/` 与 `.codex/skills/` 内容应保持一致，避免行为分裂。
- 若需要新增 repo 级 skill（如术语表/规划流程），优先放在 `skills/<skill>/`，并在 `skills/README.md` 登记。

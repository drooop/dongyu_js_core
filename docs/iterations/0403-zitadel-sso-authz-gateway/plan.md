---
title: "Iteration 0403 Plan"
doc_type: iteration-plan
status: planned
updated: 2026-06-03
source: ai
iteration_id: 0403-zitadel-sso-authz-gateway
id: 0403-zitadel-sso-authz-gateway
phase: phase1
---

# Iteration 0403 Plan

## 0. Metadata
- ID: 0403-zitadel-sso-authz-gateway
- Date: 2026-06-02
- Owner: drop
- Branch: dropx/dev_0403-zitadel-sso-authz-gateway
- Related:
  - ZITADEL OIDC Authorization Code + PKCE: https://zitadel.com/docs/guides/integrate/login/oidc/login-users
  - ZITADEL role retrieval: https://zitadel.com/docs/guides/integrate/retrieve-user-roles
  - ZITADEL create/verify human user: https://zitadel.com/docs/guides/manage/user/reg-create-user
  - ZITADEL logout: https://zitadel.com/docs/guides/integrate/login/oidc/logout
  - Matrix Client-Server API login and SSO/token flow: https://spec.matrix.org/latest/client-server-api/
  - Matrix SSO client login older guide, supplemental: https://matrix.org/docs/older/client-sso-guide/
  - Existing architecture explainer: `docs/dongyu-app-zitadel-matrix-auth-visualized.html`

## 1. Goal
把 Dongyu App 登录改为以 ZITADEL SSO 为主的 Tier 2 可用闭环：访客只能看公开只读内容，已登录用户按 ZITADEL 角色使用授权范围内的滑动 App、Workspace 和 Matrix/管理总线能力。

## 2. Background
当前远端 `sso.dongyudigital.com` 已公开 OIDC metadata，Matrix homeserver 也声明 `m.login.sso` 与 `m.login.token`。本项目已有旧的 Matrix 密码登录和 `dy_session`，但 remote frontend 没有真正接入 `authStore`，也没有 ZITADEL OIDC callback、角色映射、访客只读裁剪和权限不足 UI。

本次设计把 ZITADEL 作为身份与授权主源；Dongyu App 只保存自己的业务 session，并在用户需要 Matrix/管理总线时通过 Matrix SSO redirect 获取 Matrix access token。Dongyu App 不承担 MAS 或身份提供方职责。

## 3. Invariants (Must Not Change)
- ZITADEL 是主身份源；Dongyu App 不创建新的 SSO provider，不替代 MAS。
- Dongyu App session 只用于本应用内鉴权、UI 状态、capability 缓存和 Matrix token 持有，不向外签发身份。
- Matrix access token 必须通过 Matrix 支持的 SSO/token login flow 获得，不能把 ZITADEL token 直接当 Matrix token 使用。
- Matrix SSO callback 必须使用 server 生成、短 TTL、一次性的 pending state 绑定当前 Dongyu session；未知、过期、缺失、重放或无 capability 的 callback 必须拒绝。
- 访客默认 read-only；所有会改变 ModelTable、Workspace、slide app、Matrix、管理总线或媒体上传的请求必须经过 server-side 权限检查。
- UI 仍是 ModelTable projection；业务状态不能由前端直接越权写入。
- 不引入 repo secret；client secret、session secret、service credentials 只能来自环境变量或远端已有 secret 管理。
- 不触碰远端集群运行时、system service、network/firewall/CNI 等禁止操作。
- 每个实施阶段完成后必须 sub-agent review；若 review 提出 Change Requested，修正并重新 review，直到 Approved 后才能进入下一阶段。

## 4. Scope
### 4.1 In Scope
- 复用现有 ZITADEL human account `drop.yang@dongyudigital.com` 作为本次 SSO 验证账号；不再阻塞于创建 `nwpuyyc@163.com`。
- 如后续权限不足，只记录缺口并要求在 ZITADEL 中补齐角色/授权；不通过浏览器 token 抽取或猜测 API 凭据绕过。
- 确认或创建 Dongyu App OIDC application，登记本地与远端 callback/logout URL。
- 实现 Dongyu App 的 ZITADEL OIDC login/callback/logout/me flow，并生成 `dy_session`。
- 从 ZITADEL token/userinfo 中读取用户身份、email、roles，并映射为 Dongyu capability。
- 实现访客只读：公开 snapshot/stream 必须裁剪，写接口必须拒绝访客。
- 实现权限不足行为：保留 return URL，展示清晰的 login redirect/permission denied UI。
- 接入 frontend remote mode 的 auth state，提供右上角账号下拉、Login、Logout、Matrix connect 状态。
- 对 Matrix/管理总线能力接入 Matrix SSO token flow，并把 Matrix access token 挂到 Dongyu session。
- 覆盖本地 deterministic tests、build、browser login/logout/redirect/visitor smoke，最后跑通真实 SSO。

### 4.2 Out of Scope
- 不重写 MAS、Synapse/MAS/ZITADEL 部署。
- 不把 Dongyu App 做成通用 identity provider。
- 不实现长期 session 数据库；Tier 2 先沿用现有内存 session 模式，但必须清楚记录生产风险。
- 不扩大 Matrix Chat 的业务功能，只接权限和 token 来源。
- 不改动无关 iteration 的 Matrix Chat 0402 UX 内容。

## 5. Non-goals
- 不开放访客写操作。
- 不为了方便验证把 auth guard 关掉。
- 不在代码或文档中固化真实 secret、token、临时密码。
- 不引入兼容旧 result topic 或旧 bus 绕线路径。

## 6. Success Criteria (Definition of Done)
- ZITADEL 中已有 human account `drop.yang@dongyudigital.com` 可完成本次 SSO；账号验证证据只记录非敏感字段。
- 未登录访问 Dongyu App 可以看到公开只读内容；尝试写入、打开受限滑动 App、Matrix 或管理总线动作时，被 server 拒绝并在 UI 中得到合适的登录/权限提示。
- 已登录用户通过 `https://sso.dongyudigital.com/oauth/v2/authorize` 完成 SSO，回到 Dongyu App 后 `/auth/me` 返回身份、roles 和 capabilities。
- 登录后右上角下拉显示当前用户、权限范围、Matrix connect 状态和 Logout；Logout 后本地 session 清除，并按 ZITADEL logout 规则跳转或回到访客态。
- 具备 Matrix capability 的用户可以通过 Matrix SSO redirect 获取 Matrix access token，并完成至少一次 Matrix Chat 或管理总线只读/基础动作验证。
- 不具备目标 capability 的用户进入受限页面会看到权限不足页面，且可一键跳转 SSO login 后返回原页面。
- 所有 resolution steps 均有 PASS runlog、sub-agent Approved review、deterministic test/build/browser evidence。

## 7. Risks & Mitigations
- Risk: OIDC callback 需要 state/PKCE cookie，现有 `SameSite=Strict` 可能导致 callback 丢失状态。
  - Impact: SSO 登录回调失败。
  - Mitigation: OIDC transient cookie 使用 `SameSite=Lax`、短 TTL、HttpOnly；session cookie 评估改为 Lax 或独立处理。
- Risk: ZITADEL roles 没有出现在 ID token/userinfo。
  - Impact: Dongyu capability 映射为空，已登录用户仍无法使用功能。
  - Mitigation: 按 ZITADEL 文档启用 role assert 或在 scope 中请求 role claims，并补 `/auth/me` role diagnostics。
- Risk: Matrix SSO 与 Dongyu SSO 是两个 token flow。
  - Impact: 用户已登录 Dongyu 但还没有 Matrix access token。
  - Mitigation: 登录后自动或显式触发 Matrix connect；利用浏览器已有 ZITADEL session 让 Matrix SSO 快速完成。
- Risk: 访客 snapshot 若直接返回完整 runtime，会泄露受限 Matrix/Workspace 状态。
  - Impact: 只读仍可能过度暴露数据。
  - Mitigation: 增加 principal-aware snapshot filtering，访客仅返回 public route/app 所需模型和非敏感 labels。
- Risk: 当前工作树已有 0402 未完成变更。
  - Impact: 0403 实施容易混入无关改动。
  - Mitigation: Phase 3 前切换到独立 0403 分支或独立 worktree，并在每个 step diff review 中只接受 0403 相关文件。

## 8. Open Questions
- 现有账号 `drop.yang@dongyudigital.com` 的角色 claim 是否已覆盖 Dongyu App、Matrix 和管理总线能力；如果没有，需要在 ZITADEL Console 中补授权。
- 如果 ZITADEL 中已存在 Dongyu App project/application，需要确认是否复用；否则按本计划创建新的 application。
- 访客公开范围默认按 Home/Public docs/Static 只读处理，Workspace、Matrix、管理总线和 slide app 写入均受限；如需更窄或更宽，需要在实施前调整。

## 9. Compliance Checklists

### 9.1 SSOT Alignment Checklist
- SSOT references:
  - `CLAUDE.md`
  - `docs/WORKFLOW.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/label_type_registry.md`
  - `docs/ssot/pin_connection_contract_v2.md`
  - `docs/ssot/ui_to_matrix_event_flow.md`
  - `docs/ssot/temporary_modeltable_payload_v1.md`
- Notes:
  - 本次是 Tier 2 auth/capability gateway，不新增 Tier 1 runtime semantics。
  - 若 UI 模型必须扩展，只扩展渲染组件/壳层状态，不把权限 truth 放到前端。

### 9.2 Charter Compliance Checklist
- Charter references:
  - `CLAUDE.md` workflow, remote safety, data ownership, self-verification.
  - `docs/WORKFLOW.md` Phase 0-4 and Review Gate.
- Notes:
  - Phase 1 只写 docs。
  - Phase 3 必须在 Approved 后执行。
  - 每个 implementation step 必须 sub-agent review 后才能继续。

> 禁止在本文件写 Step 编号、执行命令、commit 记录与验证输出。

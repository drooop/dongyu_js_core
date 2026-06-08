---
title: "Iteration 0411 OIDC RP Logout Plan"
doc_type: iteration_plan
status: completed
updated: 2026-06-09
source: ai
---

# Iteration 0411 Plan

## 0. Metadata
- ID: 0411-oidc-rp-logout
- Date: 2026-06-09
- Owner: Codex
- Branch: dropx/dev_0411-oidc-rp-logout
- Related:
  - `docs/iterations/0403-zitadel-sso-authz-gateway/`

## 1. Goal
修复用户点击退出登录后，再点击登录会直接复用退出前 Zitadel 身份的问题。

## 2. Background
当前 `/auth/logout` 只清理 Dongyu App 本地 session，没有结束浏览器中的 Zitadel SSO session。因此下一次进入 `/auth/sso/start` 时，Zitadel 仍认为用户已登录，会直接签回旧身份。

## 3. Scope
- 前端退出按钮改为整页跳转本域 `/auth/logout`。
- 服务端 `GET /auth/logout` 清本地 session 后，按 OIDC RP-initiated logout 跳转 Zitadel `end_session_endpoint`。
- `POST /auth/logout` 保留为只清本地 session 的非浏览器兼容入口。
- 补充回归测试，覆盖正常 end-session、unsafe endpoint 回退、前端不读取上游 logout URL。

## 4. Non-goals
- 不重做登录 UI。
- 不改变用户角色和 capability 映射。
- 不改变 Matrix SSO bridge 行为。

## 5. Success Criteria
- 再次登录前会先完成 Zitadel logout 流程，不直接复用退出前身份。
- 前端 JS 不接触 `id_token_hint`。
- unsafe `end_session_endpoint` 不会把浏览器跳到外部地址。
- Auth、permission、Matrix SSO 代表性回归通过。


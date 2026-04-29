---
title: "0353 Slide App Runtime Docs Publish Plan"
doc_type: iteration_plan
status: approved
updated: 2026-04-30
source: codex
---

# 0353 Slide App Runtime Docs Publish Plan

## Goal

Publish the `minimal_submit_app_provider` Markdown and HTML documents from `docs/user-guide/slide-app-runtime/` so they are directly reachable on `https://app.dongyudigital.com`.

## Done Criteria

- Markdown docs are copied into the deployed `DOCS_ROOT` asset tree and can be opened by the existing Docs UI model.
- The self-contained HTML guide is copied into a deployed Static project and can be opened via `/p/<project>/`.
- Workspace exposes a cellwise UI model entry for the provider docs, with granular `Heading`, `Paragraph`, `Markdown`, and `Link` cells rather than a raw HTML/WebView blob.
- A deterministic test verifies the docs/static asset publication contract.
- Remote deployment updates `app.dongyudigital.com`.
- Browser verification opens the docs UI entry and the direct static HTML URL on the remote site.

## Stages

1. Publish assets through the existing persisted asset sync path.
2. Add a cellwise Workspace doc entry and contract test.
3. Deploy to remote and verify with a real browser.

## Boundaries

- Do not add new runtime semantics.
- Do not duplicate the guide text into an opaque HTML-only UI cell.
- Do not make business-side effects; this is documentation and static publishing only.

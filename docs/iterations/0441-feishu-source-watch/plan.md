---
title: "Iteration 0441 Feishu Source Watch Plan"
doc_type: iteration-plan
status: approved
updated: 2026-07-08
source: ai
iteration_id: 0441-feishu-source-watch
id: 0441-feishu-source-watch
phase: phase1
---

# Iteration 0441-feishu-source-watch Plan

## Goal

Create a durable way to track the four maintained Feishu collaboration documents behind this repository's SSOT decisions, so later Feishu edits can be reviewed as incremental changes instead of forcing a full document reread.

The tracking mechanism must preserve the current authority model: Feishu documents are source input, while repository SSOT remains the decision surface.

## Source Documents

Current maintained Feishu group, from `docs/ssot/feishu_alignment_decisions_v0.md`:

| Role | Title | URL |
|---|---|---|
| Main | `软件工人模型2（整理改写版 v0）` | `https://bob3y2gxxp.feishu.cn/wiki/Wurow8wi2iFyJqkDu81cyySQnlf` |
| Rules | `软件工人模型2-标签与连接规则 v0` | `https://bob3y2gxxp.feishu.cn/wiki/QnzqwrqRgiUOjUkzTA3chrVfnBd` |
| Examples | `软件工人模型2-完整模型表示例 v0` | `https://bob3y2gxxp.feishu.cn/wiki/LlBKwio3MiaIEBkLnaOcfzx4nuh` |
| Planning | `软件工人模型2-Tier2实现与模型ID规划 v0` | `https://bob3y2gxxp.feishu.cn/wiki/RazQwQpPjiZXtZkBIoocZq9Unuc` |

## Official API Findings

- `订阅云文档事件`: `POST /open-apis/drive/v1/files/:file_token/subscribe`, with `file_type=docx`; for non-folder documents it subscribes to all related cloud-doc events rather than one selected event.
- `文件编辑` event: `drive.file.edit_v1`; the event body identifies `file_token`, `file_type`, operators, subscribers, and event metadata. It does not include semantic content diff.
- `获取云文档内容`: `GET /open-apis/docs/v1/content`, currently supports docx Markdown output with `doc_token`, `doc_type=docx`, `content_type=markdown`; rate limit is 5 requests per second.
- `获取知识空间节点信息`: `GET /open-apis/wiki/v2/spaces/get_node`; required for current `/wiki/...` source URLs because it resolves a wiki node token to the actual cloud-document `obj_token`.
- `获取文档纯文本内容`: `GET /open-apis/docx/v1/documents/:document_id/raw_content`; useful as a lower-fidelity fallback when Markdown fetch is unavailable.
- `获取文档版本列表`: `GET /open-apis/drive/v1/files/:file_token/versions`; useful for saved versions, but not a complete edit feed by itself.

## Recommended Design

Use a hybrid watch:

1. Event mode for real-time awareness when Feishu app credentials and event receiving are configured.
2. Poll mode as the default local fallback, so Codex can still refresh changes on demand without a public webhook.
3. Local snapshot diff as the actual source of truth for change review, because the official edit event says a file changed but does not provide the changed sections.

## Scope

- In scope:
  - Define a no-secrets manifest for the maintained Feishu source group.
  - Define a local cache layout for snapshots, hashes, and last-seen event ids.
  - Define a diff report format that groups changes by document and heading.
  - Define the review rule for mapping Feishu changes into repository SSOT decisions.
  - Define a confirmation rule for any apparent conflict, rejection, or delay against Feishu meeting-consensus content.
  - Keep raw Feishu content out of committed files by default unless a later iteration explicitly approves committing selected excerpts or summaries.
- Out of scope:
  - Automatically applying Feishu edits to SSOT.
  - Replacing `docs/ssot/feishu_alignment_decisions_v0.md`.
  - Storing app secrets, access tokens, or raw private document dumps in git.
  - Remote deployment of a webhook receiver.

## Invariants / Constraints

- Feishu source material never overrides repository SSOT automatically.
- Any Feishu change that affects formal rules must be reviewed through a registered iteration before SSOT changes.
- The tool may classify directly compatible changes as `adopt_plan_update`.
- The tool must not make final `reject` or `defer` decisions by itself.
- If a Feishu change appears incompatible with current SSOT, incomplete, risky, or not immediately actionable, the tool must mark it as `requires_user_confirmation`, quote the changed heading and summarize the specific issue, then stop before applying SSOT changes for that area.
- Reject/defer recommendations must include a concrete reason: current SSOT conflict, missing boundary, implementation dependency, unclear ownership, or verification risk. Vague wording such as "not aligned" is insufficient.
- The tool must show which repository SSOT files are likely affected.
- Local cache may contain raw Feishu content; committed docs must not contain secrets or full private source dumps.
- The watch must be restartable and idempotent: repeated runs without source changes produce a clear `NO_CHANGE` result.

## Success Criteria

- A future implementation can run in fixture mode without Feishu credentials and produce a deterministic change report.
- A real run with Feishu credentials can fetch the four maintained docs, save local snapshots, and report `BASELINE_CREATED`, `NO_CHANGE`, or section-level changes.
- Event mode can accept or receive `drive.file.edit_v1`, map `file_token` to the manifest entry, then trigger the same fetch-and-diff path.
- The generated report tells the next agent what changed since the last snapshot, what SSOT files may need review, and which parts are only source changes.
- The generated report treats Feishu updates as meeting-consensus input: compatible changes may become plan-update candidates; conflict/delay/rejection cases are surfaced for user/team confirmation with explicit reasons.
- Real mode resolves each wiki source through the Wiki node API before calling the Markdown content API.
- If Markdown mode is blocked by missing Wiki or Docs content scopes, real mode may fall back to `docx/v1/documents/:document_id/raw_content`; the report must mark `Source Format: raw_content` so readers know the comparison is lower fidelity.

## Verification Summary

- `git diff --check`
- `node scripts/ops/feishu_source_watch.mjs --fixture scripts/fixtures/feishu_source_watch/basic --state-dir test_files/feishu_source_watch_tmp --report test_files/feishu_source_watch_tmp/report.md`
- `node scripts/tests/test_0441_feishu_source_watch_contract.mjs`
- Optional real check after credentials are configured:
  - `node scripts/ops/feishu_source_watch.mjs --manifest docs/ssot/feishu_source_watch_manifest.json --state-dir var/feishu-source-watch --report docs/iterations/<id>/feishu-source-diff.md`

## Inputs

- Created at: 2026-07-08
- Iteration ID: 0441-feishu-source-watch
- Branch: `dropx/dev_0441-feishu-source-watch`

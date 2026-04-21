---
title: "Obsidian Migration Report 2026-02-24"
doc_type: note
status: active
updated: 2026-04-21
source: ai
---

# Obsidian Migration Report 2026-02-24

## Summary
- Scope: `__DY_PROTECTED_WL_0__` vault (`docs/` symlink target)
- Files scanned: 177 markdown files
- Migration mode: phase `all` + `--apply`

## Before
- with_frontmatter: 3
- without_frontmatter: 174
- missing_required_frontmatter_docs: 3
- with_wikilink_docs: 2

## Migration Result
- selected: 177
- changed: 177
- frontmatter_added: 174
- frontmatter_updated: 3
- converted_bare_md_paths: 204
- converted_markdown_md_links: 0

## After
- with_frontmatter: 177
- without_frontmatter: 0
- missing_required_frontmatter_docs: 0
- with_wikilink_docs: 56
- with_markdown_md_links_docs: 1
- with_bare_md_paths_docs: 19

## Notes
- Remaining `.md` textual references are mostly unresolved/legacy paths (for example typo path families like `docs/roadmap/...`) or external root refs (`CLAUDE.md`), kept as-is to avoid unsafe auto-correction.
- External links (`http/https`), image links, and fenced code blocks are intentionally not converted.

## Commands Used
```bash
node scripts/ops/obsidian_docs_audit.mjs --root docs
node scripts/ops/obsidian_docs_migrate.mjs --root docs --phase all
node scripts/ops/obsidian_docs_migrate.mjs --root docs --phase all --apply
node scripts/ops/obsidian_docs_audit.mjs --root docs
```

## Next
- Optional pass for unresolved legacy paths with manual mapping table.
- If future shared notes are added to `docs-shared/`, enforce shared frontmatter contract (`source/status/project`).

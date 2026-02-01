---
name: compac
description: Save compact/handoff output into docs/tmp/hadnoff_<timestamp>.md (single source of truth for compact artifacts).
---

# Compac

This is a legacy/compat mirror of `.opencode/skills/compac/SKILL.md`.

## Contract

When the user asks to "compac" / "compact" / "handoff":
- The compacted content MUST be written to `docs/tmp/hadnoff_<timestamp>.md`.
- The assistant MUST return the generated file path.
- The artifact MUST be markdown.

## Implementation Note

Use:

```bash
node scripts/compac_write_handoff.mjs < /path/to/your_compact.md
```

Or pipe directly:

```bash
printf "%s" "$CONTENT" | node scripts/compac_write_handoff.mjs
```

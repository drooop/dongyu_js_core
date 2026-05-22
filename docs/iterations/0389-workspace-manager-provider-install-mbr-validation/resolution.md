---
title: "0389 Workspace Manager Provider Install MBR Validation Resolution"
doc_type: iteration_resolution
status: approved
updated: 2026-05-20
source: codex
---

# 0389 Resolution

## Implementation Plan

### Stage 0389.2: Reproduce With Tests

Add focused tests around provider-owned bundle responses:

- A bootstrap validation test for `validateUnifiedEndpointTopicPacket`.
- A MBR filled-model code contract test, because the reproduced local failure is the MBR rejecting a valid provider bundle response with `legacy_pin_payload_metadata_removed`.
- A regression input based on the real R1 `slide_app_bundle_response.v1` shape where nested UI labels contain `write.pin` inside a ModelTable bundle payload.

Review gate: sub-agent code review.

### Stage 0389.3: Scoped Validation Fix

Change only the validation scope:

- Keep the outer pin payload and ordinary nested payload strict.
- Allow the `bundle_payload` value only inside `slide_app_bundle_response.v1`, only when it is a valid ModelTable record array.
- Keep legacy metadata rejection for all other locations.

Review gate: sub-agent code review.

### Stage 0389.4: Local Deployment And Browser Verification

Rebuild/redeploy local services that depend on the changed validation. Then verify:

- Workspace Manager opens.
- Clicking provider-owned `安装` completes.
- A new local slide app appears and opens.

Review gate: sub-agent code review of deployment/browser evidence.

### Stage 0389.5: Final Review And Closure

Run deterministic checks and final real-browser evidence before closing.

Review gate: final sub-agent `codex-code-review`.

## Rollback

Revert 0389 changes to validation tests, worker bootstrap validation, MBR role patch, and iteration docs.

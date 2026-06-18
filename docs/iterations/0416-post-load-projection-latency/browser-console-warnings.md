---
title: "0416 Browser Console Warnings"
doc_type: iteration-note
status: active
updated: 2026-06-18
source: ai
iteration_id: 0416-post-load-projection-latency
id: 0416-post-load-projection-latency
---

Total messages: 37 (Errors: 34, Warnings: 1)
Returning 35 messages for level "warning"

[ERROR] Failed to load resource: the server responded with a status of 401 (Unauthorized) @ http://localhost:30900/auth/me:0
[ERROR] sse error {err: Event} @ http://localhost:30900/assets/index-KSRB-w7J.js:784
[ERROR] Failed to load resource: the server responded with a status of 403 (Forbidden) @ http://localhost:30900/api/runtime/mode:0
[ERROR] runtime activation failed {status: 403, statusText: Forbidden, detail: {"ok":false,"error":"permission_denied","requiredC…lity":"app:write","returnTo":"/api/runtime/mode"}} @ http://localhost:30900/assets/index-KSRB-w7J.js:784
[ERROR] Failed to load resource: the server responded with a status of 403 (Forbidden) @ http://localhost:30900/ui_event:0
[ERROR] bus event response not ok {status: 403, statusText: Forbidden, detail: {"ok":false,"error":"permission_denied","requiredCapability":"app:write","returnTo":"/ui_event"}} @ http://localhost:30900/assets/index-KSRB-w7J.js:784
[ERROR] Failed to load resource: the server responded with a status of 403 (Forbidden) @ http://localhost:30900/ui_event:0
[ERROR] bus event response not ok {status: 403, statusText: Forbidden, detail: {"ok":false,"error":"permission_denied","requiredCapability":"app:write","returnTo":"/ui_event"}} @ http://localhost:30900/assets/index-KSRB-w7J.js:784
[ERROR] sse error {err: Event} @ http://localhost:30900/assets/index-KSRB-w7J.js:784
[ERROR] Failed to load resource: net::ERR_INCOMPLETE_CHUNKED_ENCODING @ http://localhost:30900/stream:0
[ERROR] Failed to load resource: net::ERR_CONNECTION_RESET @ http://localhost:30900/ui_event:0
[ERROR] bus event fetch error {err: TypeError: Failed to fetch
    at Ie (http://localhost:30900/assets/index-KSRB-w7J.js:785:39123)
  …} @ http://localhost:30900/assets/index-KSRB-w7J.js:784
[ERROR] Failed to load resource: net::ERR_CONNECTION_RESET @ http://localhost:30900/snapshot:0
[ERROR] snapshot fetch error {context: bus event fetch error, err: TypeError: Failed to fetch
    at Ce (http://localhost:30900/assets/index-KSRB-w7J.js:785:37887)
  …} @ http://localhost:30900/assets/index-KSRB-w7J.js:784
[ERROR] Failed to load resource: net::ERR_CONNECTION_RESET @ http://localhost:30900/ui_event:0
[ERROR] bus event fetch error {err: TypeError: Failed to fetch
    at Ie (http://localhost:30900/assets/index-KSRB-w7J.js:785:39123)
  …} @ http://localhost:30900/assets/index-KSRB-w7J.js:784
[ERROR] Failed to load resource: net::ERR_CONNECTION_RESET @ http://localhost:30900/snapshot:0
[ERROR] snapshot fetch error {context: bus event fetch error, err: TypeError: Failed to fetch
    at Ce (http://localhost:30900/assets/index-KSRB-w7J.js:785:37887)
  …} @ http://localhost:30900/assets/index-KSRB-w7J.js:784
[ERROR] Failed to load resource: net::ERR_CONNECTION_RESET @ http://localhost:30900/ui_event:0
[ERROR] bus event fetch error {err: TypeError: Failed to fetch
    at Ie (http://localhost:30900/assets/index-KSRB-w7J.js:785:39123)
  …} @ http://localhost:30900/assets/index-KSRB-w7J.js:784
[ERROR] Failed to load resource: net::ERR_CONNECTION_RESET @ http://localhost:30900/snapshot:0
[ERROR] snapshot fetch error {context: bus event fetch error, err: TypeError: Failed to fetch
    at Ce (http://localhost:30900/assets/index-KSRB-w7J.js:785:37887)
  …} @ http://localhost:30900/assets/index-KSRB-w7J.js:784
[ERROR] sse error {err: Event} @ http://localhost:30900/assets/index-KSRB-w7J.js:784
[ERROR] Failed to load resource: net::ERR_CONNECTION_RESET @ http://localhost:30900/stream:0
[ERROR] sse error {err: Event} @ http://localhost:30900/assets/index-KSRB-w7J.js:784
[ERROR] Failed to load resource: net::ERR_CONNECTION_RESET @ http://localhost:30900/stream:0
[ERROR] sse error {err: Event} @ http://localhost:30900/assets/index-KSRB-w7J.js:784
[ERROR] Failed to load resource: net::ERR_CONNECTION_RESET @ http://localhost:30900/stream:0
[ERROR] sse error {err: Event} @ http://localhost:30900/assets/index-KSRB-w7J.js:784
[ERROR] Failed to load resource: net::ERR_CONNECTION_RESET @ http://localhost:30900/stream:0
[ERROR] sse error {err: Event} @ http://localhost:30900/assets/index-KSRB-w7J.js:784
[ERROR] Failed to load resource: net::ERR_CONNECTION_RESET @ http://localhost:30900/stream:0
[ERROR] sse error {err: Event} @ http://localhost:30900/assets/index-KSRB-w7J.js:784
[ERROR] Failed to load resource: net::ERR_CONNECTION_RESET @ http://localhost:30900/stream:0
[WARNING] sse snapshot_patch apply error {err: Error: snapshot_patch_base_mismatch
    at W (http://localhost:30900/assets/index-KSRB-w7J.js:785:3…} @ http://localhost:30900/assets/index-KSRB-w7J.js:784

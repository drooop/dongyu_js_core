# Contract: Typed Value Normalization (Editor v1)

This contract is an additive contract for iteration 0130 only.
It does NOT modify the editor v0 mailbox contract.

## Purpose

Enable a usable editor UX for editing labels with `t in {str,int,bool,json}` while keeping:

- UI only writes mailbox events
- Errors visible via `ui_event_error`
- Scriptable validation (no UI-only validation)

## Scope

- Applies to editor v1 demo (local consumer) only.
- Applies only to `label_add` / `label_update` actions.

## Input Contract

- UI writes mailbox events using the existing editor v0 envelope.
- UI may send raw input as string in `payload.value.v` regardless of `payload.value.t`.

## Consumer Contract (LocalBusAdapter v1)

For `label_add` / `label_update`:

Evaluation order requirement:

- The consumer MUST evaluate and preserve the editor v0 mailbox contract invariants first (including: reserved_cell, forbidden_k, forbidden_t).
- Typed normalization MUST NOT change the editor v0 error priority rules.
- Typed normalization is applied only after:
  - envelope + op_id schema checks
  - action checks
  - target schema checks
  - reserved_cell checks
  - forbidden_k checks
  - forbidden_t checks (i.e. value.t allowlist)

Priority guarantee:

- `invalid_int` / `invalid_bool` / `invalid_json` details MUST only be produced after all higher-priority v0 checks have passed.
- In particular, typed normalization MUST NOT mask or override `reserved_cell`, `forbidden_k`, or `forbidden_t` outcomes.

- When `value.t == "str"`:
  - `v` MUST be coerced to string (e.g. `String(v)`)
- When `value.t == "int"`:
  - `v` MUST be parsed into an integer
  - Parsing rules:
    - If `v` is a number: accept only when `Number.isSafeInteger(v)`
    - If `v` is a string:
      - consumer MUST apply `trim()` first
      - accept only when the trimmed string matches `^-?\d+$`
      - parse with `Number(trimmed)` and accept only when `Number.isSafeInteger(parsed)`
    - Reject: empty-after-trim strings, non-matching strings, NaN, non-integer numbers, non-safe integers
  - On reject: write `ui_event_error` with `code="invalid_target"`, `detail="invalid_int"`
- When `value.t == "bool"`:
  - Accept:
    - boolean literals
    - strings `"true"|"false"` after `trim()` (case-sensitive)
  - On reject: `invalid_target` / `detail="invalid_bool"`
- When `value.t == "json"`:
  - Accept: any JSON-serializable value
  - If `v` is a string:
    - consumer MUST apply `trim()` first
    - if empty-after-trim: reject as `invalid_target` / `detail="invalid_json"`
    - consumer MUST attempt `JSON.parse(trimmed)`
    - if parse fails: reject as `invalid_target` / `detail="invalid_json"`
    - if parse succeeds: use the parsed value
  - If `v` is not a string:
    - consumer MUST accept only if `JSON.stringify(v)` does not throw
    - if `JSON.stringify(v)` throws: reject as `invalid_target` / `detail="invalid_json"`

On success:
- consumer MUST call `runtime.addLabel(model, p,r,c, { k, t: value.t, v: normalizedValue })`

## Compatibility

- The editor v0 validation suite remains authoritative for v0 behavior.
- If v1 behavior would break v0 tests, the demo must version the adapter (e.g. v0 vs v1 mode) and keep v0 tests pinned to v0 mode.

## ui_event_error Note

- This iteration may extend `ui_event_error.v.detail` values.
- The editor v0 `ui_event_error` stale rules remain unchanged.

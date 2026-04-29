---
title: "Iteration 0351 Plan - Slide App Minimal Provider Guide"
doc_type: iteration-plan
status: active
updated: 2026-04-29
source: ai
---

# Iteration 0351-slide-app-minimal-provider-guide Plan

## Goal

- Add a provider-facing cookbook for the smallest useful slide app:
  `Input + Submit Button + Display Label`.
- The guide must let an external app provider write the app without first learning
  this repository's Model 0, server, importer, or management-bus internals.
- The guide must still use the current ModelTable / pin payload contract.

## Scope

- In scope:
- New user-guide document under `docs/user-guide/slide-app-runtime/`.
- Full cell inventory for the example app.
- Full `app_payload.json` example with only temporary ModelTable records.
- Full `handle_submit` `func.js` content.
- A deterministic documentation contract test that parses the guide example and
  verifies the submit program works in the current importer/runtime.
- Out of scope:
- Runtime behavior changes.
- New renderer components.
- Remote deployment.
- A generic SDK or packaging CLI.

## Invariants / Constraints

- `CLAUDE.md` remains authoritative.
- Iteration is registered before implementation.
- UI remains a ModelTable projection; final business writes must be performed by
  program labels, not direct browser truth mutation.
- Pin payload values must be temporary ModelTable record arrays.
- Imported slide app payloads must not include installed positive `model_id`
  values or host-owned Model 0 wiring.
- Submit program examples must not use legacy `ctx.writeLabel`,
  `ctx.getLabel`, or compatibility aliases.

## Success Criteria

- The new guide explains the provider mental model in plain language.
- The guide contains the complete cell table, full JSON payload, and full
  JavaScript handler.
- The JSON payload is parseable and accepted by the slide importer.
- The parsed example can be imported into a temporary runtime and its
  `submit_request` pin updates the display label.
- User-guide index pages link to the new guide.
- Targeted tests and docs gate pass.

## Inputs

- Created at: 2026-04-29
- Iteration ID: 0351-slide-app-minimal-provider-guide

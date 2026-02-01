# Iteration 0133-ui-component-gallery-v0 Runlog

## Log Format
- Keep entries compact.
- Record: date/time, what changed, validations run + PASS/FAIL.
- Do not paste secrets or large blobs.

## Entries

### 2026-01-31

- Docs: registered iteration in `docs/ITERATIONS.md`; added `docs/iterations/0133-ui-component-gallery-v0/{plan.md,resolution.md,runlog.md}`.
- Wave A (part 1): added hash virtual router + `#/gallery` Gallery shell (ModelTable-driven local store) + Home entry button.
  - New: `packages/ui-model-demo-frontend/src/router.js`
  - New: `packages/ui-model-demo-frontend/src/gallery_model.js`
  - New: `packages/ui-model-demo-frontend/src/gallery_store.js`
  - Update: `packages/ui-model-demo-frontend/src/demo_app.js`, `packages/ui-model-demo-frontend/src/main.js`
- Validation:
  - `npm -C packages/ui-model-demo-frontend run test` PASS
  - `npm -C packages/ui-model-demo-frontend run build` PASS

### 2026-01-31 (Wave A part 2)

- Renderer: added Element Plus controls for Wave A subset (props/events):
  - New node types: `Checkbox`, `RadioGroup`, `Radio`, `Slider`
  - Optional `bind.change` supported for observable `change` events (still mailbox-driven).
  - `TableColumn` scoped ctx support preserved (`$ref: 'row.*'`).
  - Updated: `packages/ui-renderer/src/renderer.mjs`
- Gallery: added a real "Wave A Controls" section to exercise Checkbox/RadioGroup/Slider with ModelTable bindings.
  - Updated: `packages/ui-model-demo-frontend/src/gallery_model.js`
- Validation:
  - `node scripts/validate_ui_ast_v0x.mjs` PASS
  - `npm -C packages/ui-model-demo-frontend run test` PASS
  - `npm -C packages/ui-model-demo-frontend run build` PASS

### 2026-01-31 (Wave A verification scripts)

- Added Gallery validations:
  - `packages/ui-model-demo-frontend/scripts/validate_gallery_ast.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_gallery_events.mjs`
- Validation:
  - `node packages/ui-model-demo-frontend/scripts/validate_gallery_ast.mjs` PASS
  - `node packages/ui-model-demo-frontend/scripts/validate_gallery_events.mjs` PASS

### 2026-01-31 (Wave B)

- Renderer: added Wave B node types + bindings (incl. Pagination dual v-model via `bind.models`):
  - `DatePicker`, `TimePicker`, `Tabs`, `TabPane`, `Dialog`, `Pagination`
  - Updated: `packages/ui-renderer/src/renderer.mjs`, `packages/ui-renderer/src/renderer.js`
- Gallery: added "Wave B Controls" demos and initialized default state labels.
  - Updated: `packages/ui-model-demo-frontend/src/gallery_model.js`, `packages/ui-model-demo-frontend/src/gallery_store.js`
- Validation:
  - `node scripts/validate_ui_ast_v0x.mjs` PASS
  - `node packages/ui-model-demo-frontend/scripts/validate_gallery_ast.mjs` PASS
  - `node packages/ui-model-demo-frontend/scripts/validate_gallery_events.mjs` PASS
  - `npm -C packages/ui-model-demo-frontend run test` PASS
  - `npm -C packages/ui-model-demo-frontend run build` PASS

### 2026-01-31 (Wave C)

- Renderer: added `Include` node type (render fragment AST stored in a label ref).
  - Updated: `packages/ui-renderer/src/renderer.mjs`, `packages/ui-renderer/src/renderer.js`
- Gallery: added "Wave C Composition" demos:
  - Static reuse: two `Include` nodes reference same fragment label
  - Submodel: button triggers `submodel_create` for model 2001; store seeds `ui_fragment_v0` after creation
  - Updated: `packages/ui-model-demo-frontend/src/gallery_model.js`, `packages/ui-model-demo-frontend/src/gallery_store.js`
- Validation:
  - `node scripts/validate_ui_ast_v0x.mjs` PASS
  - `node packages/ui-model-demo-frontend/scripts/validate_gallery_ast.mjs` PASS
  - `node packages/ui-model-demo-frontend/scripts/validate_gallery_events.mjs` PASS
  - `npm -C packages/ui-model-demo-frontend run test` PASS
  - `npm -C packages/ui-model-demo-frontend run build` PASS

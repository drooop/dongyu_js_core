#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

const UI_PATCH_FILES = [
  'packages/worker-base/system-models/nav_catalog_ui.json',
  'packages/worker-base/system-models/home_catalog_ui.json',
  'packages/worker-base/system-models/docs_catalog_ui.json',
  'packages/worker-base/system-models/static_catalog_ui.json',
  'packages/worker-base/system-models/prompt_catalog_ui.json',
  'packages/worker-base/system-models/workspace_catalog_ui.json',
  'packages/worker-base/system-models/sliding_flow_shell_ui.json',
  'packages/worker-base/system-models/editor_test_catalog_ui.json',
  'packages/worker-base/system-models/gallery_catalog_ui.json',
  'packages/worker-base/system-models/matrix_debug_surface.json',
  'packages/worker-base/system-models/login_catalog_ui.json',
  'packages/worker-base/system-models/workspace_positive_models.json',
  'packages/worker-base/system-models/test_model_100_ui.json',
  'packages/worker-base/system-models/doc_page_filltable_example_minimal.json',
];

const DEDICATED_PROP_LABELS = {
  align: 'ui_align',
  border: 'ui_border',
  buttonLabel: 'ui_button_label',
  emptyText: 'ui_empty_text',
  gap: 'ui_gap',
  height: 'ui_height',
  label: 'ui_label',
  layout: 'ui_layout',
  maxWidth: 'ui_max_width',
  minWidth: 'ui_min_width',
  options: 'ui_options_json',
  placeholder: 'ui_placeholder',
  prop: 'ui_prop',
  rowKey: 'ui_row_key',
  size: 'ui_size',
  stripe: 'ui_stripe',
  text: 'ui_text',
  title: 'ui_title',
  type: 'ui_variant',
  width: 'ui_width',
  wrap: 'ui_wrap',
};

const FORBIDDEN_STRUCTURAL_PROPS = new Set([
  'ast',
  'children',
  'component',
  'components',
  'html',
  'innerHTML',
  'markdown',
  'page',
  'root',
  'slots',
  'template',
]);

function isUiAstLikeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (typeof value.id !== 'string' || typeof value.type !== 'string') return false;
  return Array.isArray(value.children)
    || (value.props && typeof value.props === 'object')
    || (value.bind && typeof value.bind === 'object');
}

function findUiAstLikeValues(value, pathParts = []) {
  const matches = [];
  if (!value || typeof value !== 'object') return matches;
  if (isUiAstLikeObject(value)) {
    matches.push(pathParts.join('.') || '(root)');
    return matches;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      matches.push(...findUiAstLikeValues(item, [...pathParts, `[${index}]`]));
    });
    return matches;
  }
  for (const [key, child] of Object.entries(value)) {
    matches.push(...findUiAstLikeValues(child, [...pathParts, key]));
  }
  return matches;
}

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
}

function labelValue(labels, key) {
  const label = labels && labels[key];
  return label && Object.prototype.hasOwnProperty.call(label, 'v') ? label.v : undefined;
}

function modelKey(modelId) {
  return String(modelId);
}

function ensureModel(snapshot, modelId, source) {
  const key = modelKey(modelId);
  if (!snapshot.models[key]) {
    snapshot.models[key] = {
      id: modelId,
      name: '',
      type: '',
      cells: {},
      __sources: new Set(),
    };
  }
  if (source) snapshot.models[key].__sources.add(source);
  return snapshot.models[key];
}

function ensureCell(model, p, r, c) {
  const key = `${p},${r},${c}`;
  if (!model.cells[key]) model.cells[key] = { labels: {} };
  return model.cells[key];
}

function normalizeRecords(patch) {
  if (Array.isArray(patch)) return patch;
  if (Array.isArray(patch?.records)) return patch.records;
  return [];
}

function applyPatchToSnapshot(snapshot, patch, relPath) {
  for (const record of normalizeRecords(patch)) {
    if (!record || typeof record !== 'object') continue;
    if (record.op === 'create_model' && Number.isInteger(record.model_id)) {
      const model = ensureModel(snapshot, record.model_id, relPath);
      if (typeof record.name === 'string') model.name = record.name;
      if (typeof record.type === 'string') model.type = record.type;
      continue;
    }
    if (!Number.isInteger(record.model_id)) continue;
    if (!Number.isInteger(record.p) || !Number.isInteger(record.r) || !Number.isInteger(record.c)) continue;
    if (typeof record.k !== 'string' || !record.k) continue;
    const model = ensureModel(snapshot, record.model_id, relPath);
    const cell = ensureCell(model, record.p, record.r, record.c);
    cell.labels[record.k] = { t: record.t, v: record.v };
  }
}

export function buildUiComplianceSnapshot() {
  const snapshot = { models: {} };
  for (const relPath of UI_PATCH_FILES) {
    applyPatchToSnapshot(snapshot, readJson(relPath), relPath);
  }
  return snapshot;
}

function getRootLabels(model) {
  return model?.cells?.['0,0,0']?.labels || {};
}

function collectNodeDefs(model) {
  const defs = [];
  for (const [coord, cell] of Object.entries(model?.cells || {})) {
    const labels = cell?.labels || {};
    const id = labelValue(labels, 'ui_node_id');
    const type = labelValue(labels, 'ui_component');
    if (typeof id !== 'string' || !id || typeof type !== 'string' || !type) continue;
    defs.push({
      coord,
      id,
      type,
      parent: labelValue(labels, 'ui_parent'),
      order: labelValue(labels, 'ui_order'),
      propsJson: labelValue(labels, 'ui_props_json'),
      labels,
    });
  }
  return defs;
}

function collectPageCatalogModels(snapshot) {
  const labels = snapshot.models['-2']?.cells?.['0,0,0']?.labels || {};
  const catalog = labelValue(labels, 'ui_page_catalog_json');
  const out = new Set();
  if (!Array.isArray(catalog)) return out;
  for (const entry of catalog) {
    if (entry && Number.isInteger(entry.model_id)) out.add(entry.model_id);
  }
  return out;
}

function collectPageCatalogViolations(snapshot) {
  const labels = snapshot.models['-2']?.cells?.['0,0,0']?.labels || {};
  const catalog = labelValue(labels, 'ui_page_catalog_json');
  const violations = [];
  if (!Array.isArray(catalog)) {
    violations.push({
      severity: 'high',
      scope: 'app_shell',
      message: 'ui_page_catalog_json missing or not an array',
    });
    return violations;
  }
  for (const entry of catalog) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.asset_type === 'schema_model') {
      violations.push({
        severity: 'high',
        scope: `page:${entry.page || entry.path || 'unknown'}`,
        message: 'page catalog uses schema_model as primary UI asset',
      });
    }
    if (entry.asset_type === 'model_label' && entry.asset_ref?.k === 'page_asset_v0') {
      violations.push({
        severity: 'medium',
        scope: `page:${entry.page || entry.path || 'unknown'}`,
        message: 'page catalog still references page_asset_v0 instead of a cellwise model asset',
      });
    }
  }
  return violations;
}

function isVisibleSurface(model, modelId, pageCatalogModels) {
  const rootLabels = getRootLabels(model);
  if (modelId === -3) return true;
  if (pageCatalogModels.has(modelId)) return true;
  if (labelValue(rootLabels, 'app_name') !== undefined) return true;
  if (labelValue(rootLabels, 'ui_surface_role') !== undefined) return true;
  return false;
}

function hasPageAssetAuthoring(model) {
  for (const cell of Object.values(model?.cells || {})) {
    const labels = cell?.labels || {};
    const label = labels.page_asset_v0;
    if (label && label.t === 'json') return true;
  }
  return false;
}

function hasSchemaFallbackLabels(model) {
  for (const cell of Object.values(model?.cells || {})) {
    const labels = cell?.labels || {};
    if (Array.isArray(labelValue(labels, '_field_order'))) return true;
  }
  return false;
}

function collectAstBlobViolations({ model, modelId, visible }) {
  if (!visible) return [];
  const violations = [];
  for (const [coord, cell] of Object.entries(model?.cells || {})) {
    const labels = cell?.labels || {};
    for (const [key, label] of Object.entries(labels)) {
      const matches = findUiAstLikeValues(label?.v);
      for (const matchPath of matches) {
        violations.push({
          severity: 'high',
          scope: `model:${modelId}:${coord}:${key}`,
          message: `label stores UI AST-shaped JSON blob at ${matchPath}`,
        });
      }
    }
  }
  return violations;
}

function isScalarOrArray(value) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value) || Array.isArray(value);
}

function isTemporaryPayloadRecord(value) {
  return value
    && typeof value === 'object'
    && !Array.isArray(value)
    && Number.isInteger(value.id)
    && Number.isInteger(value.p)
    && Number.isInteger(value.r)
    && Number.isInteger(value.c)
    && typeof value.k === 'string'
    && value.k.length > 0
    && typeof value.t === 'string'
    && value.t.length > 0
    && Object.prototype.hasOwnProperty.call(value, 'v')
    && !Object.prototype.hasOwnProperty.call(value, 'op')
    && !Object.prototype.hasOwnProperty.call(value, 'model_id');
}

function isTemporaryPayloadRecordArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isTemporaryPayloadRecord);
}

function auditModel({ model, modelId, pageCatalogModels, componentTypes }) {
  const rootLabels = getRootLabels(model);
  const visible = isVisibleSurface(model, modelId, pageCatalogModels);
  const nodeDefs = collectNodeDefs(model);
  const violations = [];
  const warnings = [];
  const rootNodeId = labelValue(rootLabels, 'ui_root_node_id');
  const authoring = labelValue(rootLabels, 'ui_authoring_version');

  if (visible) {
    if (authoring !== 'cellwise.ui.v1') {
      violations.push({
        severity: 'high',
        scope: `model:${modelId}`,
        message: 'visible UI surface does not declare ui_authoring_version=cellwise.ui.v1',
      });
    }
    if (typeof rootNodeId !== 'string' || !rootNodeId) {
      violations.push({
        severity: 'high',
        scope: `model:${modelId}`,
        message: 'visible UI surface does not declare ui_root_node_id',
      });
    }
    if (nodeDefs.length < 3) {
      violations.push({
        severity: 'medium',
        scope: `model:${modelId}`,
        message: `visible UI surface has too few granular component cells (${nodeDefs.length})`,
      });
    }
    if (hasPageAssetAuthoring(model)) {
      violations.push({
        severity: 'high',
        scope: `model:${modelId}`,
        message: 'visible UI surface still authors a page_asset_v0 JSON blob',
      });
    }
    if (hasSchemaFallbackLabels(model) && authoring !== 'cellwise.ui.v1') {
      violations.push({
        severity: 'high',
        scope: `model:${modelId}`,
        message: 'visible UI surface depends on schema fallback labels instead of cellwise UI',
      });
    } else if (hasSchemaFallbackLabels(model)) {
      warnings.push({
        severity: 'low',
        scope: `model:${modelId}`,
        message: 'legacy schema labels remain but are not the primary UI projection',
      });
    }
  }

  const ids = new Map();
  for (const def of nodeDefs) {
    if (!componentTypes.has(def.type)) {
      violations.push({
        severity: 'high',
        scope: `model:${modelId}:${def.coord}`,
        message: `unknown ui_component ${def.type}`,
      });
    }
    if (def.type === 'Html' && visible) {
      violations.push({
        severity: 'high',
        scope: `model:${modelId}:${def.coord}`,
        message: 'visible UI surface uses Html component',
      });
    }
    if (def.type === 'Include' && visible) {
      violations.push({
        severity: 'high',
        scope: `model:${modelId}:${def.coord}`,
        message: 'visible UI surface uses Include, which hides child structure inside a referenced JSON AST label',
      });
    }
    if (ids.has(def.id)) {
      violations.push({
        severity: 'high',
        scope: `model:${modelId}:${def.coord}`,
        message: `duplicate ui_node_id ${def.id}`,
      });
    }
    ids.set(def.id, def);
    if (def.propsJson && typeof def.propsJson === 'object' && !Array.isArray(def.propsJson)) {
      for (const key of Object.keys(def.propsJson)) {
        if (FORBIDDEN_STRUCTURAL_PROPS.has(key)) {
          violations.push({
            severity: 'high',
            scope: `model:${modelId}:${def.coord}`,
            message: `ui_props_json contains structural key ${key}`,
          });
        }
        if (visible && DEDICATED_PROP_LABELS[key] && isScalarOrArray(def.propsJson[key])) {
          violations.push({
            severity: 'medium',
            scope: `model:${modelId}:${def.coord}`,
            message: `ui_props_json.${key} should be ${DEDICATED_PROP_LABELS[key]}`,
          });
        }
      }
    }
    for (const [key, label] of Object.entries(def.labels || {})) {
      const astBlobPaths = findUiAstLikeValues(label?.v);
      for (const astBlobPath of astBlobPaths) {
        violations.push({
          severity: 'high',
          scope: `model:${modelId}:${def.coord}:${key}`,
          message: `component label stores UI AST-shaped JSON blob at ${astBlobPath}`,
        });
      }
    }
    const bindJson = labelValue(def.labels, 'ui_bind_json');
    const write = bindJson && typeof bindJson === 'object' && !Array.isArray(bindJson) ? bindJson.write : null;
    if (write && typeof write === 'object' && typeof write.pin === 'string') {
      const hasValue = Object.prototype.hasOwnProperty.call(write, 'value_ref') || Object.prototype.hasOwnProperty.call(write, 'value');
      const value = Object.prototype.hasOwnProperty.call(write, 'value_ref') ? write.value_ref : write.value;
      if (!hasValue || !isTemporaryPayloadRecordArray(value)) {
        violations.push({
          severity: 'high',
          scope: `model:${modelId}:${def.coord}:ui_bind_json`,
          message: 'pin write value must be a temporary ModelTable record array',
        });
      }
    }
  }

  if (rootNodeId && !ids.has(rootNodeId)) {
    violations.push({
      severity: 'high',
      scope: `model:${modelId}`,
      message: `ui_root_node_id ${rootNodeId} does not match a ui_node_id cell`,
    });
  }

  for (const def of nodeDefs) {
    if (def.id === rootNodeId) continue;
    if (typeof def.parent !== 'string' || !def.parent) {
      violations.push({
        severity: 'medium',
        scope: `model:${modelId}:${def.coord}`,
        message: `node ${def.id} omits ui_parent`,
      });
    } else if (!ids.has(def.parent)) {
      violations.push({
        severity: 'high',
        scope: `model:${modelId}:${def.coord}`,
        message: `node ${def.id} references missing ui_parent ${def.parent}`,
      });
    }
    if (!Number.isInteger(def.order)) {
      violations.push({
        severity: 'medium',
        scope: `model:${modelId}:${def.coord}`,
        message: `node ${def.id} omits integer ui_order`,
      });
    }
  }

  return {
    modelId,
    name: labelValue(rootLabels, 'app_name') || model.name || '',
    visible,
    authoring,
    rootNodeId,
    nodeCount: nodeDefs.length,
    sourceFiles: [...(model.__sources || [])],
    violations: [
      ...violations,
      ...collectAstBlobViolations({ model, modelId, visible }),
    ],
    warnings,
  };
}

export function auditUiModelCompliance() {
  const registry = readJson('packages/ui-renderer/src/component_registry_v1.json');
  const componentTypes = new Set(Object.keys(registry.components || {}));
  const snapshot = buildUiComplianceSnapshot();
  const pageCatalogModels = collectPageCatalogModels(snapshot);
  const catalogViolations = collectPageCatalogViolations(snapshot);
  const models = Object.values(snapshot.models)
    .filter((model) => model && Number.isInteger(model.id))
    .sort((a, b) => a.id - b.id)
    .map((model) => auditModel({
      model,
      modelId: model.id,
      pageCatalogModels,
      componentTypes,
    }));

  const visibleModels = models.filter((model) => model.visible);
  const violations = [
    ...catalogViolations,
    ...models.flatMap((model) => model.violations),
  ];
  const warnings = models.flatMap((model) => model.warnings);

  return {
    visibleModels,
    allModels: models,
    violations,
    warnings,
  };
}

function printReport(report) {
  console.log('UI Model Compliance Audit');
  console.log('');
  console.log('Visible surfaces:');
  for (const item of report.visibleModels) {
    const status = item.violations.length === 0 ? 'PASS' : 'FAIL';
    console.log(`- [${status}] model ${item.modelId} ${item.name || '(unnamed)'} nodes=${item.nodeCount} authoring=${item.authoring || '(missing)'}`);
  }
  if (report.violations.length > 0) {
    console.log('');
    console.log('Violations:');
    for (const violation of report.violations) {
      console.log(`- [${violation.severity}] ${violation.scope}: ${violation.message}`);
    }
  }
  if (report.warnings.length > 0) {
    console.log('');
    console.log('Warnings:');
    for (const warning of report.warnings) {
      console.log(`- [${warning.severity}] ${warning.scope}: ${warning.message}`);
    }
  }
  console.log('');
  console.log(`Summary: ${report.visibleModels.length} visible surfaces, ${report.violations.length} violations, ${report.warnings.length} warnings`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = auditUiModelCompliance();
  printReport(report);
  process.exit(report.violations.length > 0 ? 1 : 0);
}

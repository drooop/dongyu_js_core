#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MODEL_DISPLAY_OVERRIDES = new Map([
  [0, { title: 'Model 0', desc: '系统根 / 中间层', kind: 'system' }],
  [-1, { title: 'Model -1', desc: 'UI 事件邮箱', kind: 'system' }],
  [-2, { title: 'Model -2', desc: '编辑器/Home UI 状态投影', kind: 'system' }],
  [-3, { title: 'Model -3', desc: 'Login UI 模型', kind: 'system' }],
  [-10, { title: 'Model -10', desc: '系统运行时逻辑 (intent/mgmt/mbr)', kind: 'system' }],
  [-12, { title: 'Model -12', desc: '认知上下文', kind: 'system' }],
  [-21, { title: 'Model -21', desc: 'Prompt 页面资产', kind: 'page' }],
  [-22, { title: 'Model -22', desc: 'Home 页面资产', kind: 'page' }],
  [-23, { title: 'Model -23', desc: 'Docs 页面资产', kind: 'page' }],
  [-24, { title: 'Model -24', desc: 'Static 页面资产', kind: 'page' }],
  [-25, { title: 'Model -25', desc: 'Workspace 页面资产 / Catalog host', kind: 'page' }],
  [-26, { title: 'Model -26', desc: 'Editor Test 页面资产', kind: 'page' }],
  [-100, { title: 'Model -100', desc: '矩阵调试 / Bus Trace', kind: 'system' }],
  [-101, { title: 'Model -101', desc: 'Gallery 邮箱', kind: 'system' }],
  [-102, { title: 'Model -102', desc: 'Gallery 状态', kind: 'system' }],
  [-103, { title: 'Model -103', desc: 'Gallery 目录', kind: 'system' }],
  [1, { title: 'Model 1', desc: '用户模型 / demo', kind: 'user' }],
  [2, { title: 'Model 2', desc: '用户模型', kind: 'user' }],
  [100, { title: 'Model 100', desc: '颜色生成器', kind: 'user' }],
  [1001, { title: 'Model 1001', desc: '用户模型', kind: 'user' }],
  [1002, { title: 'Model 1002', desc: '用户模型', kind: 'user' }],
  [1003, { title: 'Model 1003', desc: '用户模型', kind: 'user' }],
  [1004, { title: 'Model 1004', desc: '用户模型', kind: 'user' }],
  [1005, { title: 'Model 1005', desc: 'sliding_ui 父模型', kind: 'user' }],
  [1006, { title: 'Model 1006', desc: 'sliding_ui 子模型', kind: 'user' }],
  [1007, { title: 'Model 1007', desc: 'three-scene 父模型', kind: 'user' }],
  [1008, { title: 'Model 1008', desc: 'three-scene 子模型', kind: 'user' }],
]);

function walkJsonFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkJsonFiles(full));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
  }
  return out;
}

function classifySource(relPath) {
  const base = path.basename(relPath);
  const isLegacy = relPath.includes('.legacy');
  const isTemplate = relPath.includes('/templates/');
  const isFixture = base === 'test_model_100_full.json' || base === 'workspace_demo_apps.json' || isLegacy || isTemplate;

  if (relPath === 'packages/ui-model-demo-server/server.mjs#bootstrap') {
    return { scopeId: 'server-bootstrap', scopeLabel: 'server bootstrap', canonical: true };
  }
  if (relPath.startsWith('deploy/sys-v1ns/remote-worker/')) {
    return { scopeId: 'deploy-remote-worker', scopeLabel: 'deploy remote-worker', canonical: true };
  }
  if (relPath.startsWith('deploy/sys-v1ns/ui-side-worker/')) {
    return { scopeId: 'deploy-ui-side-worker', scopeLabel: 'deploy ui-side-worker', canonical: true };
  }
  if (relPath.startsWith('deploy/sys-v1ns/mbr/')) {
    return { scopeId: 'deploy-mbr', scopeLabel: 'deploy mbr', canonical: true };
  }
  if (isFixture) {
    return { scopeId: 'fixture', scopeLabel: 'fixture / legacy', canonical: false };
  }
  if (base === 'workspace_catalog_ui.json') {
    return { scopeId: 'workspace-catalog', scopeLabel: 'workspace catalog', canonical: true };
  }
  if (base === 'runtime_hierarchy_mounts.json') {
    return { scopeId: 'ui-runtime-hierarchy', scopeLabel: 'ui runtime hierarchy', canonical: true };
  }
  if (base === 'workspace_positive_models.json') {
    return { scopeId: 'workspace-positive-models', scopeLabel: 'workspace positive models', canonical: true };
  }
  if (base === 'gallery_catalog_ui.json') {
    return { scopeId: 'gallery-catalog', scopeLabel: 'gallery catalog', canonical: true };
  }
  if (base.endsWith('_catalog_ui.json') || base.endsWith('_surface.json')) {
    return { scopeId: 'page-assets', scopeLabel: 'page assets', canonical: true };
  }
  if (base === 'test_model_100_ui.json') {
    return { scopeId: 'model100-local', scopeLabel: 'model100 local ui', canonical: true };
  }
  return { scopeId: 'system-bootstrap', scopeLabel: 'system bootstrap', canonical: true };
}

function normalizeForm(t) {
  if (t === 'submt') return 'model.submt';
  if (typeof t === 'string' && t.startsWith('model.')) return t;
  return null;
}

async function readServerBootstrapModels(repoRoot) {
  const relPath = 'packages/ui-model-demo-server/server.mjs#bootstrap';
  const serverPath = path.join(repoRoot, 'packages/ui-model-demo-server/server.mjs');
  const modelIdsPath = path.join(repoRoot, 'packages/ui-model-demo-frontend/src/model_ids.js');
  const text = fs.readFileSync(serverPath, 'utf8');
  const imported = await import(pathToFileURL(modelIdsPath).href);
  const constants = {};
  for (const [key, value] of Object.entries(imported)) {
    if (Number.isInteger(value)) constants[key] = value;
  }
  for (const match of text.matchAll(/const\s+([A-Z_]+)\s*=\s*(-?\d+);/g)) {
    constants[match[1]] = Number(match[2]);
  }

  const items = [];
  for (const match of text.matchAll(/runtime\.createModel\(\{\s*id:\s*([A-Z_]+)\s*,\s*name:\s*'([^']+)'\s*,\s*type:\s*'([^']+)'\s*\}\);/g)) {
    const id = constants[match[1]];
    if (!Number.isInteger(id)) continue;
    items.push({
      id,
      name: match[2],
      type: match[3],
      relPath,
      scope: classifySource(relPath),
    });
  }
  return items;
}

function ensureModel(modelsMap, id) {
  if (!modelsMap.has(id)) {
    const override = MODEL_DISPLAY_OVERRIDES.get(id) || null;
    modelsMap.set(id, {
      id,
      title: override?.title || `Model ${id}`,
      desc: override?.desc || '',
      kind: override?.kind || (id < 0 ? 'system' : 'user'),
      runtimeType: null,
      form: null,
      declaredBy: [],
      sources: [],
      sourceScopes: new Set(),
      canonical: false,
    });
  }
  return modelsMap.get(id);
}

function recordModelSource(model, sourceInfo, kind) {
  const key = `${sourceInfo.relPath}:${kind}`;
  if (!model.declaredBy.includes(key)) model.declaredBy.push(key);
  if (!model.sources.some((entry) => entry.relPath === sourceInfo.relPath)) {
    model.sources.push({
      relPath: sourceInfo.relPath,
      scopeId: sourceInfo.scope.scopeId,
      scopeLabel: sourceInfo.scope.scopeLabel,
      canonical: sourceInfo.scope.canonical,
    });
  }
  model.sourceScopes.add(sourceInfo.scope.scopeId);
  model.canonical = model.canonical || sourceInfo.scope.canonical;
}

function finalizeModels(modelsMap) {
  return [...modelsMap.values()]
    .map((model) => ({
      ...model,
      sourceScopes: [...model.sourceScopes].sort(),
      sources: [...model.sources].sort((a, b) => a.relPath.localeCompare(b.relPath)),
      declaredBy: [...model.declaredBy].sort(),
    }))
    .sort((a, b) => a.id - b.id);
}

function buildAudit(models, mounts, predicate) {
  const selectedModels = models.filter(predicate);
  const selectedMounts = mounts.filter((mount) => predicate(mount));
  const mountedChildren = new Set(selectedMounts.map((mount) => mount.child));
  const unmountedModels = selectedModels
    .filter((model) => model.id !== 0 && !mountedChildren.has(model.id))
    .sort((a, b) => a.id - b.id);

  const byChild = new Map();
  for (const mount of selectedMounts) {
    if (!byChild.has(mount.child)) byChild.set(mount.child, []);
    byChild.get(mount.child).push(mount);
  }
  const duplicateChildren = [...byChild.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([child, entries]) => ({ child, entries }))
    .sort((a, b) => a.child - b.child);

  return {
    declaredModelCount: selectedModels.length,
    mountCount: selectedMounts.length,
    unmountedCount: unmountedModels.length,
    duplicateCount: duplicateChildren.length,
    unmountedModels,
    duplicateChildren,
  };
}

function buildProfile(id, label, models, mounts, modelPredicate, mountPredicate) {
  const profileModels = models.filter(modelPredicate);
  const profileMounts = mounts.filter(mountPredicate);
  return {
    id,
    label,
    models: profileModels,
    mounts: profileMounts,
    audit: buildAudit(profileModels, profileMounts, () => true),
  };
}

function buildVizPayload(analysis) {
  const scopes = analysis.scopes.map((scope) => ({
    id: scope.scopeId,
    label: scope.scopeLabel,
    canonical: scope.canonical,
    modelCount: scope.modelCount,
    mountCount: scope.mountCount,
  }));
  return {
    generatedAt: analysis.generatedAt,
    models: analysis.models,
    mounts: analysis.mounts,
    scopes,
    audit: analysis.audit,
    profiles: Object.fromEntries(Object.entries(analysis.profiles).map(([id, profile]) => [id, {
      id,
      label: profile.label,
      modelCount: profile.models.length,
      mountCount: profile.mounts.length,
      modelIds: profile.models.map((model) => model.id),
      mounts: profile.mounts,
      audit: {
        declaredModelCount: profile.audit.declaredModelCount,
        mountCount: profile.audit.mountCount,
        unmountedCount: profile.audit.unmountedCount,
        duplicateCount: profile.audit.duplicateCount,
        unmountedModels: profile.audit.unmountedModels,
        duplicateChildren: profile.audit.duplicateChildren,
      },
    }])),
  };
}

export async function analyzeModelMounting({ repoRoot = process.cwd() } = {}) {
  const modelsMap = new Map();
  const mounts = [];
  const sourceStats = new Map();

  const jsonFiles = [
    ...walkJsonFiles(path.join(repoRoot, 'packages/worker-base/system-models')),
    ...walkJsonFiles(path.join(repoRoot, 'deploy/sys-v1ns')),
  ];

  for (const filePath of jsonFiles) {
    const relPath = path.relative(repoRoot, filePath).replaceAll(path.sep, '/');
    const scope = classifySource(relPath);
    const sourceInfo = { relPath, scope };
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const records = Array.isArray(raw.records) ? raw.records : [];
    for (const record of records) {
      if (!record || !Number.isInteger(record.model_id)) continue;
      const model = ensureModel(modelsMap, record.model_id);
      recordModelSource(model, sourceInfo, 'record');
      if (record.op === 'create_model') {
        if (typeof record.name === 'string' && !model.runtimeType) model.title = model.title || record.name;
        if (typeof record.type === 'string' && !model.runtimeType) model.runtimeType = record.type;
      }
      if (record.k === 'model_type' && record.p === 0 && record.r === 0 && record.c === 0) {
        const form = normalizeForm(record.t);
        if (form) model.form = form;
      }
      const mountForm = normalizeForm(record.t);
      if (mountForm !== 'model.submt') continue;
      const legacyChild = Number.parseInt(String(record.k ?? ''), 10);
      const child = Number.isInteger(record.v)
        ? record.v
        : (record.v && Number.isInteger(record.v.id)
            ? record.v.id
            : (Number.isInteger(legacyChild) ? legacyChild : null));
      if (!Number.isInteger(child)) continue;
      ensureModel(modelsMap, child);
      mounts.push({
        parent: record.model_id,
        child,
        cell: `(${record.p},${record.r},${record.c})`,
        relPath,
        scopeId: scope.scopeId,
        scopeLabel: scope.scopeLabel,
        canonical: scope.canonical,
      });
    }
  }

  for (const bootstrap of await readServerBootstrapModels(repoRoot)) {
    const model = ensureModel(modelsMap, bootstrap.id);
    if (!model.runtimeType) model.runtimeType = bootstrap.type;
    if (!model.desc && bootstrap.name) model.desc = bootstrap.name;
    recordModelSource(model, { relPath: bootstrap.relPath, scope: bootstrap.scope }, 'server-bootstrap');
  }

  const models = finalizeModels(modelsMap);
  for (const model of models) {
    if (!model.form) {
      if (model.id === 0) model.form = 'model.table';
      else if (model.id < 0) model.form = model.form || 'unknown';
    }
  }

  for (const scope of [
    ...new Map(
      [...models.flatMap((model) => model.sources.map((source) => [source.scopeId, source])), ...mounts.map((mount) => [mount.scopeId, mount])]
        .map((entry) => [entry[0], entry[1]]),
    ).values(),
  ]) {
    sourceStats.set(scope.scopeId, {
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      canonical: !!scope.canonical,
      modelCount: models.filter((model) => model.sourceScopes.includes(scope.scopeId)).length,
      mountCount: mounts.filter((mount) => mount.scopeId === scope.scopeId).length,
    });
  }

  const analysis = {
    generatedAt: new Date().toISOString(),
    models,
    mounts: mounts.sort((a, b) => a.parent - b.parent || a.child - b.child || a.relPath.localeCompare(b.relPath)),
    scopes: [...sourceStats.values()].sort((a, b) => a.scopeId.localeCompare(b.scopeId)),
  };

  analysis.audit = {
    canonical: buildAudit(analysis.models, analysis.mounts, (entry) => entry.canonical === true),
    all: buildAudit(analysis.models, analysis.mounts, () => true),
  };

  const modelHasSource = (model, predicate) => model.sources.some(predicate);
  const mountFrom = (predicate) => (mount) => predicate({ relPath: mount.relPath, scopeId: mount.scopeId, canonical: mount.canonical });

  analysis.profiles = {
    'ui-server': buildProfile(
      'ui-server',
      'ui-server',
      analysis.models,
      analysis.mounts,
      (model) => model.canonical && (
        modelHasSource(model, (source) => source.relPath === 'packages/ui-model-demo-server/server.mjs#bootstrap')
        || modelHasSource(model, (source) => source.relPath.startsWith('packages/worker-base/system-models/') && !source.relPath.includes('.legacy'))
      ),
      mountFrom((source) => source.relPath.startsWith('packages/worker-base/system-models/') && !source.relPath.includes('.legacy')),
    ),
    'remote-worker': buildProfile(
      'remote-worker',
      'remote-worker',
      analysis.models,
      analysis.mounts,
      (model) => modelHasSource(model, (source) => (
        source.relPath === 'packages/worker-base/system-models/system_models.json'
        || source.relPath.startsWith('deploy/sys-v1ns/remote-worker/')
      )),
      mountFrom((source) => source.relPath.startsWith('deploy/sys-v1ns/remote-worker/')),
    ),
    'ui-side-worker': buildProfile(
      'ui-side-worker',
      'ui-side-worker',
      analysis.models,
      analysis.mounts,
      (model) => modelHasSource(model, (source) => (
        source.relPath === 'packages/worker-base/system-models/system_models.json'
        || source.relPath.startsWith('deploy/sys-v1ns/ui-side-worker/')
      )),
      mountFrom((source) => source.relPath.startsWith('deploy/sys-v1ns/ui-side-worker/')),
    ),
    'mbr-worker': buildProfile(
      'mbr-worker',
      'mbr-worker',
      analysis.models,
      analysis.mounts,
      (model) => modelHasSource(model, (source) => (
        source.relPath === 'packages/worker-base/system-models/system_models.json'
        || source.relPath.startsWith('deploy/sys-v1ns/mbr/')
      )),
      mountFrom((source) => source.relPath.startsWith('deploy/sys-v1ns/mbr/')),
    ),
  };

  return analysis;
}

function parseArgs(argv) {
  const options = { json: false, writeViz: false };
  for (const arg of argv) {
    if (arg === '--json') options.json = true;
    if (arg === '--write-viz') options.writeViz = true;
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const analysis = await analyzeModelMounting({ repoRoot: process.cwd() });
  const payload = buildVizPayload(analysis);

  if (options.writeViz) {
    fs.writeFileSync(
      path.join(process.cwd(), 'viz-model-mounting-data.js'),
      `window.MODEL_MOUNTING_DATA = ${JSON.stringify(payload, null, 2)};\n`,
      'utf8',
    );
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  process.stdout.write(`generated_at=${analysis.generatedAt}\n`);
  process.stdout.write(`canonical_declared=${analysis.audit.canonical.declaredModelCount}\n`);
  process.stdout.write(`canonical_mounts=${analysis.audit.canonical.mountCount}\n`);
  process.stdout.write(`canonical_unmounted=${analysis.audit.canonical.unmountedCount}\n`);
  process.stdout.write(`canonical_duplicates=${analysis.audit.canonical.duplicateCount}\n`);
  for (const [id, profile] of Object.entries(analysis.profiles)) {
    process.stdout.write(`${id}_unmounted=${profile.audit.unmountedCount}\n`);
    process.stdout.write(`${id}_duplicates=${profile.audit.duplicateCount}\n`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((err) => {
    process.stderr.write(`${err && err.stack ? err.stack : err}\n`);
    process.exitCode = 1;
  });
}

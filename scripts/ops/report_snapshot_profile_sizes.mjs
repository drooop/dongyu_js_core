#!/usr/bin/env node
import {
  buildClientSnapshotProfileWithStats,
  createServerState,
} from '../../packages/ui-model-demo-server/server.mjs';

function parseArgs(argv) {
  const out = {
    visibleModelId: null,
    topModels: 8,
    topLabels: 12,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--visible-model-id') {
      out.visibleModelId = Number.parseInt(String(argv[i + 1] || ''), 10);
      i += 1;
      continue;
    }
    if (arg === '--top-models') {
      out.topModels = Math.max(0, Number.parseInt(String(argv[i + 1] || ''), 10) || out.topModels);
      i += 1;
      continue;
    }
    if (arg === '--top-labels') {
      out.topLabels = Math.max(0, Number.parseInt(String(argv[i + 1] || ''), 10) || out.topLabels);
      i += 1;
      continue;
    }
    if (arg === '--json') {
      out.json = true;
      continue;
    }
  }
  return out;
}

function firstPositiveWorkspaceAppModelId(snapshot) {
  const registry = snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v;
  if (Array.isArray(registry)) {
    const entry = registry.find((item) => Number.isInteger(item?.model_id) && item.model_id > 0);
    if (entry) return entry.model_id;
  }
  const modelIds = Object.keys(snapshot?.models || {})
    .map((key) => Number.parseInt(key, 10))
    .filter((modelId) => Number.isInteger(modelId) && modelId > 0)
    .sort((a, b) => a - b);
  return modelIds[0] ?? null;
}

function summarizeProfile(name, snapshot, options, limits) {
  const body = buildClientSnapshotProfileWithStats(snapshot, {
    ...options,
    topLabelLimit: Math.max(limits.topLabels, 20),
    topCellLimit: 20,
  });
  const stats = body.snapshot_stats;
  return {
    name,
    profile: stats.profile,
    visible_model_ids: stats.visible_model_ids,
    bytes: stats.total_bytes,
    model_count: stats.model_count,
    cell_count: stats.cell_count,
    label_count: stats.label_count,
    dropped_model_count: stats.dropped_model_count,
    dropped_label_count: stats.dropped_label_count,
    top_models: stats.models.slice(0, limits.topModels),
    top_cells: stats.cells.slice(0, limits.topCells ?? limits.topModels),
    top_labels: stats.top_labels.slice(0, limits.topLabels),
  };
}

function printText(report) {
  console.log(`visible_model_id=${report.visible_model_id}`);
  for (const profile of report.profiles) {
    console.log(`\n[${profile.name}]`);
    console.log(`bytes=${profile.bytes} models=${profile.model_count} cells=${profile.cell_count} labels=${profile.label_count} dropped_models=${profile.dropped_model_count} dropped_labels=${profile.dropped_label_count}`);
    console.log('top_models=');
    for (const model of profile.top_models) {
      console.log(`  ${model.model_id}: bytes=${model.bytes} cells=${model.cell_count} labels=${model.label_count}`);
    }
    console.log('top_cells=');
    for (const cell of profile.top_cells) {
      console.log(`  ${cell.model_id}/${cell.p},${cell.r},${cell.c}: bytes=${cell.bytes} labels=${cell.label_count}`);
    }
    console.log('top_labels=');
    for (const label of profile.top_labels) {
      console.log(`  ${label.model_id}/${label.p},${label.r},${label.c}/${label.k}: bytes=${label.bytes} t=${label.t}`);
    }
  }
}

const args = parseArgs(process.argv.slice(2));
const state = createServerState({ dbPath: null });
const snapshot = state.clientSnap();
const visibleModelId = Number.isInteger(args.visibleModelId)
  ? args.visibleModelId
  : firstPositiveWorkspaceAppModelId(snapshot);
const limits = { topModels: args.topModels, topLabels: args.topLabels };
const report = {
  visible_model_id: visibleModelId,
  profiles: [
    summarizeProfile('bootstrap', snapshot, { profile: 'bootstrap' }, limits),
    summarizeProfile(`visible:${visibleModelId}`, snapshot, { profile: 'visible', visibleModelIds: [visibleModelId] }, limits),
    summarizeProfile('full', snapshot, { profile: 'full' }, limits),
  ],
};

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printText(report);
}

#!/usr/bin/env node

import fs from 'node:fs';
import {
  FILLTABLE_CAPABILITY_SCENARIOS,
  FILLTABLE_CAPABILITY_SUBSETS,
  selectFilltableCapabilityScenarios,
} from './filltable_capability_cases.mjs';

const args = process.argv.slice(2);
let baseUrl = 'http://127.0.0.1:9016';
let reportFile = '';
const scenarioIds = [];
const tags = [];
let listOnly = false;

function usage() {
  console.log(`Usage:
  node scripts/ops/run_filltable_capability_matrix.mjs [options]

Options:
  --base-url <url>        Server base URL (default: http://127.0.0.1:9016)
  --scenario <id>         Run one scenario id (repeatable)
  --tag <tag>             Run all scenarios with tag (repeatable)
  --report-file <path>    Write JSON report to file
  --list                  Print available scenarios and tags
  -h, --help              Show help`);
}

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--base-url') {
    baseUrl = args[++i] || '';
  } else if (arg === '--scenario') {
    scenarioIds.push(args[++i] || '');
  } else if (arg === '--tag') {
    tags.push(args[++i] || '');
  } else if (arg === '--report-file') {
    reportFile = args[++i] || '';
  } else if (arg === '--list') {
    listOnly = true;
  } else if (arg === '-h' || arg === '--help') {
    usage();
    process.exit(0);
  } else {
    throw new Error(`unknown option: ${arg}`);
  }
}

if (listOnly) {
  console.log(JSON.stringify({
    scenarios: FILLTABLE_CAPABILITY_SCENARIOS.map((item) => ({ id: item.id, tags: item.tags, description: item.description })),
    tags: Object.keys(FILLTABLE_CAPABILITY_SUBSETS),
  }, null, 2));
  process.exit(0);
}

const selected = selectFilltableCapabilityScenarios(scenarioIds, tags);
if (selected.length === 0) {
  throw new Error('no scenarios selected');
}

for (const id of scenarioIds) {
  if (!FILLTABLE_CAPABILITY_SCENARIOS.some((item) => item.id === id)) {
    throw new Error(`unknown scenario id: ${id}`);
  }
}
for (const tag of tags) {
  if (!Object.keys(FILLTABLE_CAPABILITY_SUBSETS).includes(tag) && !FILLTABLE_CAPABILITY_SCENARIOS.some((item) => item.tags.includes(tag))) {
    throw new Error(`unknown tag: ${tag}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(method, path, payload) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${method} ${path} failed: ${response.status} ${text}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

async function snapshot() {
  return request('GET', '/snapshot');
}

async function activateRuntime() {
  const out = await request('POST', '/api/runtime/mode', { mode: 'running' });
  if (!out || out.ok !== true || out.mode !== 'running') {
    throw new Error(`runtime activation failed: ${JSON.stringify(out)}`);
  }
}

function rootStateByModel(snapshotJson, modelIds) {
  const models = snapshotJson?.snapshot?.models || {};
  const out = {};
  for (const modelId of modelIds) {
    const labels = models[String(modelId)]?.cells?.['0,0,0']?.labels || {};
    out[String(modelId)] = Object.fromEntries(
      Object.entries(labels).map(([key, value]) => [key, value?.v]),
    );
  }
  return out;
}

function presenceByModel(snapshotJson, modelIds) {
  const models = snapshotJson?.snapshot?.models || {};
  const out = {};
  for (const modelId of modelIds) {
    out[String(modelId)] = Object.prototype.hasOwnProperty.call(models, String(modelId));
  }
  return out;
}

function editorLabels(snapshotJson) {
  return snapshotJson?.snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels || {};
}

async function writePrompt(promptText, opId) {
  await request('POST', '/ui_event', {
    payload: {
      action: 'label_update',
      source: 'ui_renderer',
      meta: { op_id: opId, local_only: true, model_id: -2 },
      target: { model_id: -2, p: 0, r: 0, c: 0, k: 'llm_prompt_text' },
      value: { t: 'str', v: promptText },
    },
  });
}

async function postUiEvent(action, opId, targetKey) {
  return request('POST', '/ui_event', {
    payload: {
      action,
      source: 'ui_renderer',
      meta: { op_id: opId, local_only: true, model_id: -2 },
      target: { model_id: -2, p: 0, r: 0, c: 0, k: targetKey },
    },
  });
}

function collectPreviewState(labels) {
  const preview = labels.llm_prompt_preview_json?.v || {};
  return {
    preview_id: labels.llm_prompt_preview_id?.v || '',
    apply_preview_id: labels.llm_prompt_apply_preview_id?.v || '',
    status: labels.llm_prompt_status?.v || '',
    accepted_changes: Array.isArray(preview.accepted_changes) ? preview.accepted_changes : [],
    rejected_changes: Array.isArray(preview.rejected_changes) ? preview.rejected_changes : [],
    owner_plan: Array.isArray(preview.owner_plan) ? preview.owner_plan : [],
    proposal: preview.proposal && typeof preview.proposal === 'object' ? preview.proposal : {},
    stats: preview.stats && typeof preview.stats === 'object' ? preview.stats : {},
    raw: preview,
  };
}

async function runScenario(scenario) {
  const beforeSnapshot = await snapshot();
  const before = rootStateByModel(beforeSnapshot, scenario.inspectModels);
  const beforePresent = presenceByModel(beforeSnapshot, scenario.inspectModels);
  await writePrompt(scenario.prompt, `${scenario.id}_set_prompt`);
  const previewResponse = await postUiEvent('llm_filltable_preview', `${scenario.id}_preview`, 'llm_prompt_text');
  await sleep(800);
  const previewSnapshot = await snapshot();
  const preview = collectPreviewState(editorLabels(previewSnapshot));
  const result = {
    id: scenario.id,
    prompt: scenario.prompt,
    description: scenario.description,
    tags: scenario.tags,
    before,
    before_present: beforePresent,
    preview_response: previewResponse,
    preview,
    after: before,
    after_present: beforePresent,
  };

  if (scenario.apply && preview.accepted_changes.length > 0) {
    result.apply_response = await postUiEvent('llm_filltable_apply', `${scenario.id}_apply`, 'llm_prompt_apply_preview_id');
    await sleep(800);
    const applySnapshot = await snapshot();
    result.apply_result = editorLabels(applySnapshot).llm_prompt_apply_result_json?.v || {};
    result.after = rootStateByModel(applySnapshot, scenario.inspectModels);
    result.after_present = presenceByModel(applySnapshot, scenario.inspectModels);
  } else {
    const afterSnapshot = await snapshot();
    result.after = rootStateByModel(afterSnapshot, scenario.inspectModels);
    result.after_present = presenceByModel(afterSnapshot, scenario.inspectModels);
  }

  if (scenario.probeApply) {
    result.query_apply_probe = await postUiEvent('llm_filltable_apply', `${scenario.id}_apply_probe`, 'llm_prompt_apply_preview_id');
    await sleep(300);
  }

  const errors = scenario.validate(result);
  return {
    ...result,
    pass: errors.length === 0,
    errors,
  };
}

await activateRuntime();

const report = {
  base_url: baseUrl,
  ran_at: new Date().toISOString(),
  selected_scenarios: selected.map((item) => item.id),
  results: [],
};

for (const scenario of selected) {
  report.results.push(await runScenario(scenario));
}

report.summary = {
  passed: report.results.filter((item) => item.pass).length,
  failed: report.results.filter((item) => !item.pass).length,
};

if (reportFile) {
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.summary.failed > 0 ? 1 : 0);

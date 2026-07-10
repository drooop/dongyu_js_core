import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

export const ACTOR_ATTESTATION_MARKER = 'DE_ACTOR_ATTESTATION';
export const ACTOR_ATTESTATION_MODULE = 'scripts/lib/de_actor_attestation.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');
const systemPatch = 'packages/worker-base/system-models/system_models.json';
const actorSources = Object.freeze({
  mbr: {
    patchDir: 'deploy/sys-v1ns/mbr/patches',
    runner: 'scripts/run_worker_v0.mjs',
    workerScope: 'mbr-worker',
  },
  r1: {
    patchDir: 'deploy/sys-v1ns/remote-worker/patches',
    runner: 'scripts/run_worker_remote_v1.mjs',
    workerScope: 'remote-worker',
  },
  wm1: {
    patchDir: 'deploy/sys-v1ns/workspace-manager/patches',
    runner: 'scripts/run_worker_remote_v1.mjs',
    workerScope: 'workspace-manager',
  },
});

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), 'utf8'));
}

function patchFiles(relativeDir) {
  return readdirSync(resolve(repoRoot, relativeDir))
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => join(relativeDir, file));
}

function labelAddress(modelId, p, r, c, key) {
  return `${modelId}:${p}:${r}:${c}:${key}`;
}

function updateProvenance(provenance, patch, sourceFile) {
  const records = patch && Array.isArray(patch.records) ? patch.records : [];
  for (const record of records) {
    if (!record || !Number.isInteger(record.model_id) || !Number.isInteger(record.p)
      || !Number.isInteger(record.r) || !Number.isInteger(record.c) || typeof record.k !== 'string') {
      continue;
    }
    const address = labelAddress(record.model_id, record.p, record.r, record.c, record.k);
    if (record.op === 'add_label') provenance.set(address, sourceFile);
    if (record.op === 'rm_label') provenance.delete(address);
  }
}

function sourceFor(provenance, modelId, p, r, c, key) {
  return provenance.get(labelAddress(modelId, p, r, c, key)) ?? null;
}

function allRuntimeLabels(runtime, provenance) {
  const entries = [];
  for (const [modelId, model] of runtime.models) {
    for (const cell of model.cells.values()) {
      for (const label of cell.labels.values()) {
        entries.push({
          model_id: modelId,
          p: cell.p,
          r: cell.r,
          c: cell.c,
          key: label.k,
          type: label.t,
          value: label.v,
          source_file: sourceFor(provenance, modelId, cell.p, cell.r, cell.c, label.k),
        });
      }
    }
  }
  return entries;
}

function labelsAt(entries, modelId, p = 0, r = 0, c = 0) {
  return entries.filter((entry) => (
    entry.model_id === modelId && entry.p === p && entry.r === r && entry.c === c
  ));
}

function labelsByKey(entries, modelId, p = 0, r = 0, c = 0) {
  return Object.fromEntries(labelsAt(entries, modelId, p, r, c).map((entry) => [entry.key, entry]));
}

function mountedModelId(value) {
  if (Number.isInteger(value)) return value;
  if (value && typeof value === 'object' && Number.isInteger(value.model_id)) return value.model_id;
  return null;
}

function subscriptionEndpoints(rootLabels) {
  const subscriptions = rootLabels.remote_subscriptions?.value;
  if (!Array.isArray(subscriptions)) return [];
  const endpoints = subscriptions.map((topic) => {
    const parts = typeof topic === 'string' ? topic.split('/') : [];
    if (parts.length !== 8 || !/^[1-9][0-9]*$/u.test(parts[6]) || !parts[7]) return null;
    return { model_id: Number(parts[6]), pin: parts[7], topic };
  }).filter(Boolean);
  return [...new Map(endpoints.map((endpoint) => [`${endpoint.model_id}:${endpoint.pin}`, endpoint])).values()]
    .sort((left, right) => left.model_id - right.model_id || left.pin.localeCompare(right.pin));
}

function parseModuleAst(source) {
  try {
    const frontendRequire = createRequire(resolve(repoRoot, 'packages/ui-model-demo-frontend/package.json'));
    const { parse } = frontendRequire('@babel/parser');
    return {
      ast: parse(source, {
        sourceType: 'module',
        allowAwaitOutsideFunction: true,
        plugins: ['importAttributes'],
      }),
      error: null,
    };
  } catch (error) {
    return { ast: null, error: error && error.message ? error.message : String(error) };
  }
}

function walkAst(node, visitor, parent = null, ancestors = []) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visitor(node, parent, ancestors);
  const nextAncestors = typeof node.type === 'string' ? ancestors.concat(node) : ancestors;
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) {
      for (const child of value) walkAst(child, visitor, node, nextAncestors);
    } else if (value && typeof value === 'object') {
      walkAst(value, visitor, node, nextAncestors);
    }
  }
}

function memberPath(node) {
  if (!node) return '';
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression' && !node.computed) {
    const object = memberPath(node.object);
    const property = memberPath(node.property);
    return object && property ? `${object}.${property}` : '';
  }
  return '';
}

function subtreeHasIdentifier(node, expectedName) {
  let found = false;
  walkAst(node, (candidate) => {
    if (candidate.type === 'Identifier' && candidate.name === expectedName) found = true;
  });
  return found;
}

function subtreeHasString(node, expectedValue) {
  let found = false;
  walkAst(node, (candidate) => {
    if (candidate.type === 'StringLiteral' && candidate.value === expectedValue) found = true;
  });
  return found;
}

function objectPropertyValue(objectExpression, propertyName) {
  if (!objectExpression || objectExpression.type !== 'ObjectExpression') return null;
  const property = objectExpression.properties.find((entry) => (
    entry && entry.type === 'ObjectProperty'
    && ((entry.key.type === 'Identifier' && entry.key.name === propertyName)
      || (entry.key.type === 'StringLiteral' && entry.key.value === propertyName))
  ));
  return property ? property.value : null;
}

function literalValue(node) {
  if (!node) return undefined;
  if (node.type === 'StringLiteral' || node.type === 'NumericLiteral' || node.type === 'BooleanLiteral') return node.value;
  if (node.type === 'NullLiteral') return null;
  if (node.type === 'UnaryExpression' && node.operator === '-' && node.argument?.type === 'NumericLiteral') {
    return -node.argument.value;
  }
  return undefined;
}

export function loadSsotDeActor(name) {
  const source = actorSources[name];
  if (!source) throw new Error(`unknown_actor:${name}`);

  const sourceFiles = [systemPatch, ...patchFiles(source.patchDir)];
  const runtime = new ModelTableRuntime();
  const provenance = new Map();
  const loadResults = [];
  for (const sourceFile of sourceFiles) {
    const patch = readJson(sourceFile);
    if (!patch || !Array.isArray(patch.records)) throw new Error(`invalid_patch_records:${sourceFile}`);
    const result = runtime.applyPatch(patch, { allowCreateModel: true, trustedBootstrap: true });
    loadResults.push({ source_file: sourceFile, applied: result.applied, rejected: result.rejected });
    updateProvenance(provenance, patch, sourceFile);
  }

  const entries = allRuntimeLabels(runtime, provenance);
  const rootLabels = labelsByKey(entries, 0);
  const workerId = rootLabels.sys_worker_id?.value ?? null;
  const workerRole = rootLabels.sys_worker_role?.value ?? null;
  const workerAlias = rootLabels.mqtt_worker_id?.value
    ?? rootLabels.workspace_manager_worker_id?.value
    ?? null;
  const topicBase = rootLabels.mqtt_topic_base?.value ?? null;
  const busPins = labelsAt(entries, 0).filter((entry) => entry.type.startsWith('pin.bus.'));
  const mounts = entries
    .filter((entry) => entry.type === 'model.submtconnection')
    .map((entry) => ({
      ...entry,
      parent_model_id: entry.model_id,
      child_model_id: mountedModelId(entry.value),
    }));
  const functions = entries.filter((entry) => entry.type === 'func.js' || entry.type === 'func.python');
  const connections = entries.filter((entry) => entry.type === 'pin.connect.cell');
  const labelConnections = entries.filter((entry) => entry.type === 'pin.connect.label');
  const modelMinus10Labels = labelsByKey(entries, -10);
  const directModelMinus10InboxConfig = [
    'mbr_matrix_inbox_label',
    'mbr_matrix_func',
    'mbr_mqtt_inbox_label',
    'mbr_mqtt_func',
  ].map((key) => modelMinus10Labels[key]).filter(Boolean);
  const mqttIngressPin = rootLabels.mqtt_ingress_pin?.value ?? null;
  const subscribedEndpoints = subscriptionEndpoints(modelMinus10Labels);
  const subscribedModelIds = [...new Set(subscribedEndpoints.map((endpoint) => endpoint.model_id))]
    .sort((left, right) => left - right);

  return {
    name,
    runtime,
    patchDir: source.patchDir,
    workerScope: source.workerScope,
    sourceFiles,
    loadResults,
    loadRejected: loadResults.reduce((total, result) => total + result.rejected, 0),
    entries,
    rootLabels,
    rootForm: rootLabels.model_type ?? null,
    workerId,
    workerRole,
    workerAlias,
    topicBase,
    busPins,
    mounts,
    functions,
    rootFunctions: functions.filter((entry) => entry.model_id === 0),
    connections,
    labelConnections,
    directModelMinus10InboxConfig,
    mqttIngressPin,
    subscribedEndpoints,
    subscribedModelIds,
    directPositiveIngressRisk: subscribedModelIds.length > 0 && !mqttIngressPin,
    runnerPath: source.runner,
  };
}

export function loadSsotDeActors() {
  return Object.fromEntries(Object.keys(actorSources).map((name) => [name, loadSsotDeActor(name)]));
}

export function expectedActorAttestation(actor) {
  const mountedModels = [...new Set(actor.mounts.map((mount) => mount.child_model_id).filter(Number.isInteger))]
    .sort((left, right) => left - right);
  const busPins = actor.busPins
    .map((pin) => ({ key: pin.key, type: pin.type }))
    .sort((left, right) => left.key.localeCompare(right.key));
  return {
    worker_id: actor.workerId,
    worker_role: actor.workerRole,
    worker_alias: actor.workerAlias,
    topic_base: actor.topicBase,
    root_form: actor.rootForm ? {
      key: actor.rootForm.key,
      type: actor.rootForm.type,
      value: actor.rootForm.value,
    } : null,
    bus_pins: busPins,
    mounted_models: mountedModels,
    source_files: [...actor.sourceFiles],
  };
}

export async function importActorAttestationModule() {
  const absolutePath = resolve(repoRoot, ACTOR_ATTESTATION_MODULE);
  if (!existsSync(absolutePath)) return { module: null, error: `missing:${ACTOR_ATTESTATION_MODULE}` };
  try {
    const module = await import(`${pathToFileURL(absolutePath).href}?test=${Date.now()}`);
    return { module, error: null };
  } catch (error) {
    return { module: null, error: error && error.message ? error.message : String(error) };
  }
}

export function inspectRunnerAttestationAst(runnerPath) {
  const source = readFileSync(resolve(repoRoot, runnerPath), 'utf8');
  const parsed = parseModuleAst(source);
  if (!parsed.ast) return { runnerPath, violations: [`ast_parse_failed:${parsed.error}`] };

  let builderLocal = null;
  let markerLocal = null;
  const loadCalls = [];
  const buildDeclarations = [];
  const outputCalls = [];
  walkAst(parsed.ast, (node, parent) => {
    if (node.type === 'ImportDeclaration' && node.source?.value === './lib/de_actor_attestation.mjs') {
      for (const specifier of node.specifiers || []) {
        if (specifier.type !== 'ImportSpecifier') continue;
        if (specifier.imported?.name === 'buildDeActorAttestation') builderLocal = specifier.local.name;
        if (specifier.imported?.name === 'ACTOR_ATTESTATION_MARKER') markerLocal = specifier.local.name;
      }
    }
    if (node.type !== 'CallExpression') return;
    const callee = memberPath(node.callee);
    if (callee === 'loadSystemPatch' || callee === 'applyPersistedAssetEntries' || callee === 'rt.applyPatch') {
      loadCalls.push(node);
    }
    if (builderLocal && callee === builderLocal && parent?.type === 'VariableDeclarator' && parent.id?.type === 'Identifier') {
      buildDeclarations.push({ call: node, variable: parent.id.name });
    }
    if (callee === 'process.stdout.write' || callee === 'console.log') outputCalls.push(node);
  });

  const violations = [];
  if (!builderLocal) violations.push('missing_builder_import');
  if (!markerLocal) violations.push('missing_marker_import');
  if (buildDeclarations.length !== 1) violations.push(`builder_call_count:${buildDeclarations.length}`);
  const build = buildDeclarations[0] || null;
  if (build) {
    const options = build.call.arguments[0];
    if (objectPropertyValue(options, 'runtime')?.name !== 'rt') violations.push('builder_runtime_must_be_loaded_rt');
    if (!objectPropertyValue(options, 'sourceFiles')) violations.push('builder_source_files_missing');
    const lastLoadStart = Math.max(-1, ...loadCalls.map((call) => call.start));
    if (build.call.start <= lastLoadStart) violations.push('builder_called_before_patch_load');
    const matchingOutput = outputCalls.find((call) => (
      call.start > build.call.start
      && subtreeHasIdentifier(call, build.variable)
      && markerLocal
      && subtreeHasIdentifier(call, markerLocal)
    ));
    if (!matchingOutput) violations.push('attestation_not_written_after_build');
  }
  return { runnerPath, violations };
}

export function inspectMbrRunnerBoundaryAst(runnerPath = 'scripts/run_worker_v0.mjs') {
  const source = readFileSync(resolve(repoRoot, runnerPath), 'utf8');
  const parsed = parseModuleAst(source);
  if (!parsed.ast) return { runnerPath, violations: [`ast_parse_failed:${parsed.error}`] };

  const negativeModelBindings = new Set();
  const modelZeroBindings = new Set();
  const adapterCallbacks = { matrix: [], mqtt: [] };

  walkAst(parsed.ast, (node, parent) => {
    if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier') {
      if (node.init?.type === 'CallExpression' && memberPath(node.init.callee) === 'rt.getModel') {
        const modelId = literalValue(node.init.arguments[0]);
        if (modelId === -10) negativeModelBindings.add(node.id.name);
        if (modelId === 0) modelZeroBindings.add(node.id.name);
      }
    }
    if (node.type !== 'CallExpression') return;
    const callee = memberPath(node.callee);
    if (callee.endsWith('.onEvent') || callee.endsWith('.subscribe')) {
      const callback = node.arguments.find((argument) => argument?.type === 'ArrowFunctionExpression' || argument?.type === 'FunctionExpression');
      if (callback) adapterCallbacks.matrix.push(callback);
    }
    if (callee.endsWith('.on') && literalValue(node.arguments[0]) === 'message') {
      const callback = node.arguments.find((argument) => argument?.type === 'ArrowFunctionExpression' || argument?.type === 'FunctionExpression');
      if (callback) adapterCallbacks.mqtt.push(callback);
    }
  });

  function callbackHasBusWrite(callback, expectedKey, expectedType, expectedValuePath) {
    let found = false;
    walkAst(callback, (node) => {
      if (node.type !== 'CallExpression' || memberPath(node.callee) !== 'rt.addLabel') return;
      const target = node.arguments[0];
      const targetsModelZero = (target?.type === 'Identifier' && modelZeroBindings.has(target.name))
        || (target?.type === 'CallExpression' && memberPath(target.callee) === 'rt.getModel' && literalValue(target.arguments[0]) === 0);
      if (!targetsModelZero) return;
      const label = node.arguments[4];
      if (literalValue(objectPropertyValue(label, 'k')) === expectedKey
        && literalValue(objectPropertyValue(label, 't')) === expectedType
        && memberPath(objectPropertyValue(label, 'v')) === expectedValuePath) found = true;
    });
    return found;
  }

  function jsonParsedBinding(callback) {
    let binding = null;
    walkAst(callback, (node) => {
      if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier'
        && node.init?.type === 'CallExpression' && memberPath(node.init.callee) === 'JSON.parse') {
        binding = node.id.name;
      }
    });
    return binding;
  }

  function callbackBypassViolations(callback, prefix) {
    const found = [];
    walkAst(callback, (node) => {
      if (node.type !== 'CallExpression') return;
      const callee = memberPath(node.callee);
      if (callee.endsWith('.executeFunction')) found.push(`${prefix}_direct_execute_function`);
      const target = node.arguments[0];
      const targetsMinus10 = (target?.type === 'Identifier' && negativeModelBindings.has(target.name))
        || (target?.type === 'CallExpression' && memberPath(target.callee) === 'rt.getModel' && literalValue(target.arguments[0]) === -10);
      if (targetsMinus10 && ['rt.addLabel', 'rt.rmLabel', 'rt.removeLabel', 'rt.setLabelValue'].includes(callee)) {
        found.push(`${prefix}_direct_model_minus10_mutation`);
      }
      if (callee === 'rt.applyPatch') found.push(`${prefix}_direct_apply_patch`);
      if ((callee.endsWith('.set') || callee.endsWith('.delete'))
        && [...negativeModelBindings].some((binding) => subtreeHasIdentifier(node, binding))) {
        found.push(`${prefix}_direct_model_minus10_collection_mutation`);
      }
    });
    return [...new Set(found)];
  }

  const violations = [];
  if (adapterCallbacks.matrix.length !== 1) violations.push(`matrix_callback_count:${adapterCallbacks.matrix.length}`);
  if (adapterCallbacks.mqtt.length !== 1) violations.push(`mqtt_callback_count:${adapterCallbacks.mqtt.length}`);
  const matrixCallback = adapterCallbacks.matrix[0] || null;
  const mqttCallback = adapterCallbacks.mqtt[0] || null;
  const matrixEventBinding = matrixCallback?.params?.[0]?.type === 'Identifier' ? matrixCallback.params[0].name : null;
  const mqttPacketBinding = mqttCallback ? jsonParsedBinding(mqttCallback) : null;
  if (matrixCallback && (!matrixEventBinding || !callbackHasBusWrite(
    matrixCallback,
    'mbr_mb_in',
    'pin.bus.mb.in',
    `${matrixEventBinding}.payload`,
  ))) {
    violations.push('matrix_must_write_event_payload_to_model0_mbr_mb_in');
  }
  if (mqttCallback && (!mqttPacketBinding || !callbackHasBusWrite(
    mqttCallback,
    'mbr_cb_in',
    'pin.bus.cb.in',
    `${mqttPacketBinding}.payload`,
  ))) {
    violations.push('mqtt_must_write_packet_payload_to_model0_mbr_cb_in');
  }
  if (matrixCallback) violations.push(...callbackBypassViolations(matrixCallback, 'matrix_callback'));
  if (mqttCallback) violations.push(...callbackBypassViolations(mqttCallback, 'mqtt_callback'));
  return { runnerPath, violations };
}

export function actorCellLabels(actor, modelId, p = 0, r = 0, c = 0) {
  return labelsByKey(actor.entries, modelId, p, r, c);
}

export function repoRelativePath(pathValue) {
  return relative(repoRoot, resolve(repoRoot, pathValue));
}

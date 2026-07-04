#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = [
  'packages/worker-base/system-models',
  'deploy/sys-v1ns',
];

function* jsonFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* jsonFiles(file);
    } else if (entry.isFile() && file.endsWith('.json')) {
      yield file;
    }
  }
}

function visit(value, file, path = [], out = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => visit(item, file, path.concat(index), out));
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  if (value.t === 'model.submt' && Number.isInteger(value.v)) {
    out.push({
      file,
      path: path.join('.'),
      model_id: value.model_id ?? value.id ?? null,
      p: value.p,
      r: value.r,
      c: value.c,
      v: value.v,
    });
  }
  for (const [key, child] of Object.entries(value)) {
    visit(child, file, path.concat(key), out);
  }
  return out;
}

const violations = [];
const modelTypeRecords = [];
for (const root of ROOTS) {
  for (const file of jsonFiles(root)) {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    violations.push(...visit(parsed, file));
    const records = [];
    const collect = (value, path = []) => {
      if (Array.isArray(value)) {
        value.forEach((item, index) => collect(item, path.concat(index)));
        return;
      }
      if (!value || typeof value !== 'object') return;
      if (value.k === 'model_type' && typeof value.t === 'string') {
        records.push({
          file,
          path: path.join('.'),
          model_id: value.model_id ?? value.id ?? null,
          p: value.p,
          r: value.r,
          c: value.c,
          t: value.t,
          v: value.v,
        });
      }
      Object.entries(value).forEach(([key, child]) => collect(child, path.concat(key)));
    };
    collect(parsed);
    modelTypeRecords.push(...records);
  }
}

assert.deepEqual(
  violations,
  [],
  `parent-side child model indexes must use model.submtconnection, not numeric model.submt:\n${violations.map((item) => `${item.file}:${item.path} model=${item.model_id} cell=${item.p},${item.r},${item.c} v=${item.v}`).join('\n')}`,
);

const rootTypesByModelId = new Map();
for (const record of modelTypeRecords) {
  if (!Number.isInteger(record.model_id) || record.p !== 0 || record.r !== 0 || record.c !== 0) continue;
  const existing = rootTypesByModelId.get(record.model_id) || [];
  existing.push(record);
  rootTypesByModelId.set(record.model_id, existing);
}

const unpairedConnections = [];
for (const record of modelTypeRecords) {
  if (record.t !== 'model.submtconnection') continue;
  const childModelId = Number.isInteger(record.v)
    ? record.v
    : (record.v && typeof record.v === 'object' && Number.isInteger(record.v.model_id) ? record.v.model_id : null);
  if (!Number.isInteger(childModelId)) continue;
  const rootTypes = rootTypesByModelId.get(childModelId) || [];
  if (rootTypes.length === 0 || rootTypes.some((rootRecord) => rootRecord.t !== 'model.submt')) {
    unpairedConnections.push({
      file: record.file,
      path: record.path,
      model_id: record.model_id,
      cell: `${record.p},${record.r},${record.c}`,
      child_model_id: childModelId,
      child_roots: rootTypes.map((rootRecord) => `${rootRecord.file}:${rootRecord.path}:${rootRecord.t}`),
    });
  }
}

assert.deepEqual(
  unpairedConnections,
  [],
  `parent-side model.submtconnection must point to child roots declared with model.submt:\n${unpairedConnections.map((item) => `${item.file}:${item.path} parent=${item.model_id} cell=${item.cell} child=${item.child_model_id} roots=${item.child_roots.join(',') || 'missing'}`).join('\n')}`,
);

console.log('[PASS] fixture_submt_connection_contract');

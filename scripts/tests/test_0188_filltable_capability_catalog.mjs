#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  FILLTABLE_CAPABILITY_SCENARIOS,
  FILLTABLE_CAPABILITY_SUBSETS,
} from '../ops/filltable_capability_cases.mjs';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const docText = fs.readFileSync(path.join(repoRoot, 'docs/user-guide/filltable_capability_matrix.md'), 'utf8');

const ids = new Set(FILLTABLE_CAPABILITY_SCENARIOS.map((item) => item.id));

for (const requiredId of [
  'typed_values_model1',
  'leave_form_model1001_exact_mapping',
  'repair_form_model1002_exact_mapping',
  'remove_and_update_model1',
  'query_only_model1001',
  'parent_child_submodel_model11_blocked',
  'non_schema_field_requires_clarification',
]) {
  assert.ok(ids.has(requiredId), `capability scenario missing: ${requiredId}`);
  assert.match(docText, new RegExp(requiredId), `capability doc must mention scenario ${requiredId}`);
}

assert.ok(Array.isArray(FILLTABLE_CAPABILITY_SUBSETS.core), 'core subset missing');
assert.ok(Array.isArray(FILLTABLE_CAPABILITY_SUBSETS.forms), 'forms subset missing');
assert.ok(Array.isArray(FILLTABLE_CAPABILITY_SUBSETS.structure), 'structure subset missing');
assert.ok(Array.isArray(FILLTABLE_CAPABILITY_SUBSETS.clarification), 'clarification subset missing');
assert.match(docText, /--scenario <id>/, 'capability doc must describe scenario selection');
assert.match(docText, /--tag <tag>/, 'capability doc must describe tag selection');
assert.match(docText, /run_filltable_capability_matrix_local\.sh/, 'capability doc must reference the local runner');

console.log('test_0188_filltable_capability_catalog: PASS');

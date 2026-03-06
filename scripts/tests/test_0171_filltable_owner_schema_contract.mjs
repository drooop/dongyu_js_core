#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const llmCfg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'packages/worker-base/system-models/llm_cognition_config.json'), 'utf8'));
const intentHandlers = JSON.parse(fs.readFileSync(path.join(repoRoot, 'packages/worker-base/system-models/intent_handlers_prompt_filltable.json'), 'utf8'));

function getRecord(doc, key) {
  return (doc.records || []).find((item) => item.k === key);
}

const promptTemplate = getRecord(llmCfg, 'llm_filltable_prompt_template');
assert.ok(promptTemplate && typeof promptTemplate.v === 'string', 'llm_filltable_prompt_template missing');
assert.match(promptTemplate.v, /candidate_changes/, 'prompt template must require candidate_changes');
assert.doesNotMatch(promptTemplate.v, /records only support op=add_label\/rm_label/, 'prompt template must not keep records/op contract');

const outputSchema = getRecord(llmCfg, 'llm_filltable_output_schema');
assert.ok(outputSchema && outputSchema.v && typeof outputSchema.v === 'object', 'llm_filltable_output_schema missing');
assert.ok(Object.prototype.hasOwnProperty.call(outputSchema.v, 'candidate_changes'), 'output schema must expose candidate_changes');
assert.ok(!Object.prototype.hasOwnProperty.call(outputSchema.v, 'records'), 'output schema must not expose records');

const previewHandler = getRecord(intentHandlers, 'handle_llm_filltable_preview');
const applyHandler = getRecord(intentHandlers, 'handle_llm_filltable_apply');
assert.ok(previewHandler && previewHandler.v && typeof previewHandler.v.code === 'string', 'preview handler missing');
assert.ok(applyHandler && applyHandler.v && typeof applyHandler.v.code === 'string', 'apply handler missing');
assert.match(previewHandler.v.code, /accepted_changes/, 'preview handler must read accepted_changes');
assert.match(previewHandler.v.code, /rejected_changes/, 'preview handler must read rejected_changes');
assert.match(applyHandler.v.code, /applied_changes/, 'apply handler must write applied_changes');
assert.doesNotMatch(previewHandler.v.code, /accepted_records/, 'preview handler must stop using accepted_records');
assert.doesNotMatch(applyHandler.v.code, /applied_records/, 'apply handler must stop using applied_records');

console.log('test_0171_filltable_owner_schema_contract: PASS');

function sortStrings(values) {
  return [...values].sort();
}

function stableJson(value) {
  return JSON.stringify(value);
}

function acceptedChangesForModel(result, modelId) {
  return (result.preview.accepted_changes || []).filter((item) => item?.target?.model_id === modelId);
}

function acceptedKeysForModel(result, modelId) {
  return acceptedChangesForModel(result, modelId).map((item) => item?.target?.k).filter(Boolean);
}

function expect(condition, message, errors) {
  if (!condition) errors.push(message);
}

function expectEqual(actual, expected, message, errors) {
  if (actual !== expected) {
    errors.push(`${message}: expected=${stableJson(expected)} actual=${stableJson(actual)}`);
  }
}

function expectJsonEqual(actual, expected, message, errors) {
  if (stableJson(actual) !== stableJson(expected)) {
    errors.push(`${message}: expected=${stableJson(expected)} actual=${stableJson(actual)}`);
  }
}

function expectSortedKeys(actual, expected, message, errors) {
  const actualSorted = sortStrings(actual);
  const expectedSorted = sortStrings(expected);
  if (stableJson(actualSorted) !== stableJson(expectedSorted)) {
    errors.push(`${message}: expected=${stableJson(expectedSorted)} actual=${stableJson(actualSorted)}`);
  }
}

function modelRoot(state, modelId) {
  return (state && state[String(modelId)]) || {};
}

function identicalModelState(before, after, modelId) {
  return stableJson(modelRoot(before, modelId)) === stableJson(modelRoot(after, modelId));
}

function identicalKeys(before, after, modelId) {
  return stableJson(Object.keys(modelRoot(before, modelId)).sort()) === stableJson(Object.keys(modelRoot(after, modelId)).sort());
}

export const FILLTABLE_CAPABILITY_SCENARIOS = [
  {
    id: 'typed_values_model1',
    tags: ['core', 'types', 'write'],
    description: 'Mixed primitive/json writes on a simple model.',
    prompt: '请更新 model 1：title 改成 Project Atlas，新增 ready=true，新增 metadata={"source":"nl","priority":2}。',
    inspectModels: [1],
    apply: true,
    validate(result) {
      const errors = [];
      expectSortedKeys(acceptedKeysForModel(result, 1), ['metadata', 'ready', 'title'], 'model 1 accepted keys mismatch', errors);
      expectEqual(result.apply_result?.applied_count, 3, 'model 1 applied count mismatch', errors);
      expectEqual(modelRoot(result.after, 1).title, 'Project Atlas', 'model 1 title mismatch', errors);
      expectEqual(modelRoot(result.after, 1).ready, true, 'model 1 ready mismatch', errors);
      expectJsonEqual(modelRoot(result.after, 1).metadata, { source: 'nl', priority: 2 }, 'model 1 metadata mismatch', errors);
      return errors;
    },
  },
  {
    id: 'leave_form_model1001_exact_mapping',
    tags: ['forms', 'mapping', 'write'],
    description: 'Free-form leave request should map to the existing schema keys and enum values.',
    prompt: '请填写请假申请（model 1001）：姓名李雷，假别病假，天数3天，事由发烧。',
    inspectModels: [1001],
    apply: true,
    validate(result) {
      const errors = [];
      expectSortedKeys(acceptedKeysForModel(result, 1001), ['applicant', 'days', 'leave_type', 'reason'], 'leave form accepted keys mismatch', errors);
      expect(!acceptedKeysForModel(result, 1001).includes('applicant_name'), 'leave form must not invent applicant_name', errors);
      expectEqual(modelRoot(result.after, 1001).applicant, '李雷', 'leave form applicant mismatch', errors);
      expectEqual(modelRoot(result.after, 1001).leave_type, 'sick', 'leave form leave_type must use option value', errors);
      expectEqual(modelRoot(result.after, 1001).days, 3, 'leave form days mismatch', errors);
      expectEqual(modelRoot(result.after, 1001).reason, '发烧', 'leave form reason mismatch', errors);
      return errors;
    },
  },
  {
    id: 'repair_form_model1002_exact_mapping',
    tags: ['forms', 'mapping', 'write'],
    description: 'Device repair free-form description should map to exact schema keys and enum values.',
    prompt: '请填写设备报修（model 1002）：设备名空调A-12，位置三楼会议室，紧急，描述为无法启动并伴有异响。',
    inspectModels: [1002],
    apply: true,
    validate(result) {
      const errors = [];
      expectSortedKeys(acceptedKeysForModel(result, 1002), ['description', 'device_name', 'location', 'urgency'], 'repair form accepted keys mismatch', errors);
      expect(!acceptedKeysForModel(result, 1002).includes('title'), 'repair form must not invent title', errors);
      expectEqual(modelRoot(result.after, 1002).device_name, '空调A-12', 'repair form device_name mismatch', errors);
      expectEqual(modelRoot(result.after, 1002).location, '三楼会议室', 'repair form location mismatch', errors);
      expectEqual(modelRoot(result.after, 1002).urgency, 'high', 'repair form urgency must use option value', errors);
      expectEqual(modelRoot(result.after, 1002).description, '无法启动并伴有异响', 'repair form description mismatch', errors);
      return errors;
    },
  },
  {
    id: 'remove_and_update_model1',
    tags: ['core', 'remove', 'write'],
    description: 'Mixed remove_label and set_label flow.',
    prompt: '把 model 1 的 metadata 删除，再把 title 改成 Project Atlas v2。',
    inspectModels: [1],
    apply: true,
    validate(result) {
      const errors = [];
      const accepted = acceptedChangesForModel(result, 1);
      expectEqual(accepted.length, 2, 'remove/update accepted change count mismatch', errors);
      expect(accepted.some((item) => item.action === 'remove_label' && item.target?.k === 'metadata'), 'remove/update must remove metadata', errors);
      expect(accepted.some((item) => item.action === 'set_label' && item.target?.k === 'title'), 'remove/update must set title', errors);
      expectEqual(modelRoot(result.after, 1).title, 'Project Atlas v2', 'remove/update title mismatch', errors);
      expect(!Object.prototype.hasOwnProperty.call(modelRoot(result.after, 1), 'metadata'), 'remove/update must leave metadata absent', errors);
      return errors;
    },
  },
  {
    id: 'query_only_model1001',
    tags: ['query', 'preview'],
    description: 'Read-only query should stay in preview and reject apply.',
    prompt: '只查看 model 1001 当前 applicant、leave_type、days、reason 的值，不要修改任何内容。',
    inspectModels: [1001],
    apply: false,
    probeApply: true,
    validate(result) {
      const errors = [];
      expectEqual((result.preview.accepted_changes || []).length, 0, 'query-only preview must not accept changes', errors);
      expectEqual((result.preview.rejected_changes || []).length, 0, 'query-only preview must not reject changes', errors);
      expect(((result.preview.proposal?.queries) || []).length >= 1, 'query-only preview must produce proposal queries', errors);
      expectEqual(result.query_apply_probe?.code, 'nothing_to_apply', 'query-only apply probe must fail with nothing_to_apply', errors);
      expect(identicalModelState(result.before, result.after, 1001), 'query-only scenario must not mutate model 1001', errors);
      return errors;
    },
  },
  {
    id: 'parent_child_submodel_model11_blocked',
    tags: ['structure', 'parent-child', 'negative'],
    description: 'Parent-child submodel creation is covered as a blocked scenario under the current policy.',
    prompt: '创建一个子模型 Model11，挂在 Model1 处，放在 model 1 的 (1,0,0)，名字叫 child11。',
    inspectModels: [1, 11],
    apply: false,
    validate(result) {
      const errors = [];
      expectEqual((result.preview.accepted_changes || []).length, 0, 'parent-child scenario must not accept structural changes under current policy', errors);
      expect(result.after_present?.['11'] === false, 'parent-child scenario must not create model 11', errors);
      expect(identicalModelState(result.before, result.after, 1), 'parent-child scenario must not mutate model 1', errors);
      return errors;
    },
  },
  {
    id: 'non_schema_field_requires_clarification',
    tags: ['clarification', 'negative'],
    description: 'Unknown non-schema field should trigger clarification rather than key invention.',
    prompt: '请填写请假申请（model 1001）：审批人王经理。其他字段别动；如果不确定字段，就先提问。',
    inspectModels: [1001],
    apply: false,
    validate(result) {
      const errors = [];
      expectEqual((result.preview.accepted_changes || []).length, 0, 'non-schema field must not produce accepted changes', errors);
      expect(typeof result.preview.proposal?.confirmation_question === 'string' && result.preview.proposal.confirmation_question.trim().length > 0, 'clarification scenario must produce a question', errors);
      expect(identicalKeys(result.before, result.after, 1001), 'clarification scenario must not invent new keys on model 1001', errors);
      return errors;
    },
  },
];

export const FILLTABLE_CAPABILITY_SUBSETS = Object.freeze({
  core: ['typed_values_model1', 'remove_and_update_model1'],
  forms: ['leave_form_model1001_exact_mapping', 'repair_form_model1002_exact_mapping'],
  query: ['query_only_model1001'],
  structure: ['parent_child_submodel_model11_blocked'],
  clarification: ['non_schema_field_requires_clarification'],
});

export function selectFilltableCapabilityScenarios(selectedIds = [], selectedTags = []) {
  const idSet = new Set(selectedIds.filter(Boolean));
  const tagSet = new Set(selectedTags.filter(Boolean));
  if (idSet.size === 0 && tagSet.size === 0) return FILLTABLE_CAPABILITY_SCENARIOS;
  return FILLTABLE_CAPABILITY_SCENARIOS.filter((item) => {
    if (idSet.has(item.id)) return true;
    if (item.tags.some((tag) => tagSet.has(tag))) return true;
    return false;
  });
}

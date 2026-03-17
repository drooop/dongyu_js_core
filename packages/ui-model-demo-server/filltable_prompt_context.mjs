function truncateString(value, maxLength = 160) {
  const text = String(value ?? '');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function summarizeValue(value, maxLength = 160) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return truncateString(value, maxLength);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  try {
    const text = JSON.stringify(value);
    if (text.length <= maxLength) return value;
    return truncateString(text, maxLength);
  } catch (_) {
    return '[unserializable]';
  }
}

function normalizeOptionList(rawValue) {
  if (!Array.isArray(rawValue)) return [];
  const options = [];
  for (const item of rawValue) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const label = Object.prototype.hasOwnProperty.call(item, 'label') ? summarizeValue(item.label, 80) : undefined;
    const value = Object.prototype.hasOwnProperty.call(item, 'value') ? summarizeValue(item.value, 80) : undefined;
    if (label === undefined && value === undefined) continue;
    options.push({
      ...(label !== undefined ? { label } : {}),
      ...(value !== undefined ? { value } : {}),
    });
    if (options.length >= 20) break;
  }
  return options;
}

function inferValueType(componentType, rootType) {
  if (typeof rootType === 'string' && rootType.trim()) return rootType.trim();
  const component = typeof componentType === 'string' ? componentType.trim().toLowerCase() : '';
  if (component.includes('number')) return 'int';
  if (component.includes('slider')) return 'float';
  if (component.includes('switch') || component.includes('checkbox')) return 'bool';
  if (component.includes('json')) return 'json';
  return 'str';
}

function collectFieldOrder(schemaLabels) {
  const labels = schemaLabels && typeof schemaLabels === 'object' ? schemaLabels : {};
  const rawOrder = labels._field_order && Array.isArray(labels._field_order.v) ? labels._field_order.v : [];
  const ordered = [];
  const seen = new Set();
  for (const item of rawOrder) {
    if (typeof item !== 'string') continue;
    const key = item.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    ordered.push(key);
  }
  for (const key of Object.keys(labels)) {
    if (!key || key.startsWith('_') || key.includes('__') || seen.has(key)) continue;
    seen.add(key);
    ordered.push(key);
  }
  return ordered;
}

function buildSchemaField(schemaLabels, rootLabels, fieldKey) {
  const schemaField = schemaLabels[fieldKey];
  const rootField = rootLabels[fieldKey];
  const propsValue = schemaLabels[`${fieldKey}__props`]?.v;
  const placeholder = propsValue && typeof propsValue === 'object' && typeof propsValue.placeholder === 'string'
    ? truncateString(propsValue.placeholder, 120)
    : undefined;
  const options = normalizeOptionList(schemaLabels[`${fieldKey}__opts`]?.v);
  const uiLabel = typeof schemaLabels[`${fieldKey}__label`]?.v === 'string'
    ? truncateString(schemaLabels[`${fieldKey}__label`].v, 80)
    : fieldKey;
  const component = typeof schemaField?.v === 'string' ? truncateString(schemaField.v, 40) : 'Input';
  return {
    key: fieldKey,
    ui_label: uiLabel,
    component,
    value_type: inferValueType(component, rootField?.t),
    ...(placeholder ? { placeholder } : {}),
    ...(options.length > 0 ? { options } : {}),
    ...(rootField ? { current_value: summarizeValue(rootField.v) } : {}),
  };
}

function buildRootField(rootLabels, key) {
  const label = rootLabels[key];
  if (!label || typeof label !== 'object') return null;
  return {
    key,
    type: typeof label.t === 'string' ? label.t : '',
    current_value: summarizeValue(label.v),
  };
}

export function buildFilltableModelInventoryFromSnapshot(snapshot, maxModels = 256) {
  const models = snapshot && typeof snapshot === 'object' && snapshot.models && typeof snapshot.models === 'object'
    ? snapshot.models
    : {};
  const ids = Object.keys(models)
    .map((idText) => Number(idText))
    .filter((id) => Number.isInteger(id) && id > 0)
    .sort((a, b) => a - b)
    .slice(0, Math.max(1, maxModels));

  return ids.map((modelId) => {
    const model = models[modelId] || models[String(modelId)] || {};
    const cells = model && typeof model === 'object' && model.cells && typeof model.cells === 'object' ? model.cells : {};
    const rootLabels = cells['0,0,0'] && cells['0,0,0'].labels && typeof cells['0,0,0'].labels === 'object'
      ? cells['0,0,0'].labels
      : {};
    const schemaLabels = cells['1,0,0'] && cells['1,0,0'].labels && typeof cells['1,0,0'].labels === 'object'
      ? cells['1,0,0'].labels
      : {};
    const schemaFields = collectFieldOrder(schemaLabels).map((fieldKey) => buildSchemaField(schemaLabels, rootLabels, fieldKey));
    const rootFields = Object.keys(rootLabels)
      .sort()
      .map((key) => buildRootField(rootLabels, key))
      .filter(Boolean);
    const schemaTitle = typeof schemaLabels._title?.v === 'string' ? truncateString(schemaLabels._title.v, 120) : '';

    return {
      model_id: modelId,
      model_name: typeof model.name === 'string' ? truncateString(model.name, 80) : String(modelId),
      app_name: typeof rootLabels.app_name?.v === 'string' ? truncateString(rootLabels.app_name.v, 120) : '',
      source_worker: typeof rootLabels.source_worker?.v === 'string' ? truncateString(rootLabels.source_worker.v, 80) : '',
      ...(schemaTitle ? { schema_title: schemaTitle } : {}),
      root_fields: rootFields.slice(0, 64),
      schema_fields: schemaFields.slice(0, 64),
    };
  });
}

import { getSnapshotModel } from './snapshot_utils.js';

function inferWriteTrigger(componentType, commitPolicy = 'immediate') {
  if (componentType === 'Button') return 'click';
  if (commitPolicy === 'on_blur') return 'blur';
  if (commitPolicy === 'on_submit') return 'submit';
  return 'change';
}

function buildWritablePins(componentType, writeBind) {
  if (!writeBind || typeof writeBind !== 'object' || typeof writeBind.pin !== 'string' || !writeBind.pin.trim()) {
    return undefined;
  }
  const rawValueRef = writeBind.value_ref;
  const value_t = rawValueRef && typeof rawValueRef === 'object' && typeof rawValueRef.t === 'string'
    ? rawValueRef.t
    : (typeof writeBind.value_t === 'string' ? writeBind.value_t : undefined);
  return [{
    name: writeBind.pin.trim(),
    direction: 'in',
    trigger: inferWriteTrigger(componentType, typeof writeBind.commit_policy === 'string' ? writeBind.commit_policy : 'immediate'),
    ...(value_t ? { value_t } : {}),
    ...(typeof writeBind.commit_policy === 'string' ? { commit_policy: writeBind.commit_policy } : {}),
    primary: true,
  }];
}

export function buildAstFromSchema(snapshot, modelId) {
  const model = getSnapshotModel(snapshot, modelId);
  if (!model || !model.cells) return null;

  const schemaCell = model.cells['1,0,0'];
  if (!schemaCell || !schemaCell.labels) return null;

  const getSchema = (k) => {
    const label = schemaCell.labels[k];
    return label ? label.v : undefined;
  };

  const fieldOrder = getSchema('_field_order');
  if (!Array.isArray(fieldOrder) || fieldOrder.length === 0) return null;

  const title = getSchema('_title') || `App ${modelId}`;
  const subtitle = getSchema('_subtitle');

  const formItems = [];
  const standaloneItems = [];

  for (let idx = 0; idx < fieldOrder.length; idx += 1) {
    const fieldName = fieldOrder[idx];
    const componentType = getSchema(fieldName);
    if (typeof componentType !== 'string' || componentType.length === 0) continue;

    const fieldLabel = getSchema(`${fieldName}__label`) || fieldName;
    const extraProps = getSchema(`${fieldName}__props`) || {};
    const opts = getSchema(`${fieldName}__opts`);
    const customBind = getSchema(`${fieldName}__bind`);
    const noWrap = getSchema(`${fieldName}__no_wrap`);

    const componentProps = typeof extraProps === 'object' && extraProps !== null ? { ...extraProps } : {};
    if (Array.isArray(opts)) {
      componentProps.options = opts;
    }

    let bind;
    if (customBind && typeof customBind === 'object') {
      bind = customBind;
    } else {
      const positiveModel = Number.isInteger(modelId) && modelId > 0;
      const positiveCommitPolicy = componentType === 'Input' ? 'on_blur' : 'on_change';
      const write = Number.isInteger(modelId) && modelId > 0
        ? {
            action: 'ui_owner_label_update',
            mode: 'intent',
            target_ref: { model_id: modelId, p: 0, r: 0, c: 0, k: fieldName },
            commit_policy: positiveCommitPolicy,
          }
        : {
            action: 'label_update',
            target_ref: { model_id: modelId, p: 0, r: 0, c: 0, k: fieldName },
          };
      bind = {
        read: { model_id: modelId, p: 0, r: 0, c: 0, k: fieldName },
        write,
      };
    }

    const node = {
      id: `schema_${modelId}_${fieldName}`,
      type: componentType,
      props: componentProps,
      bind,
      cell_ref: { model_id: modelId, p: 1, r: 0, c: 0 },
      ...(bind && bind.write ? { writable_pins: buildWritablePins(componentType, bind.write) } : {}),
    };

    if (noWrap) {
      standaloneItems.push(node);
    } else {
      formItems.push({
        id: `schema_fi_${modelId}_${fieldName}`,
        type: 'FormItem',
        props: { label: fieldLabel },
        children: [node],
      });
    }
  }

  if (formItems.length === 0 && standaloneItems.length === 0) return null;

  const children = [
    { id: `schema_title_${modelId}`, type: 'Text', props: { type: 'title', text: title } },
  ];
  if (subtitle) {
    children.push({ id: `schema_subtitle_${modelId}`, type: 'Text', props: { type: 'info', text: subtitle } });
  }
  if (formItems.length > 0) {
    children.push({
      id: `schema_form_${modelId}`,
      type: 'Form',
      children: formItems,
    });
  }
  for (const item of standaloneItems) {
    children.push(item);
  }

  return {
    id: `schema_root_${modelId}`,
    type: 'Container',
    props: { layout: 'column', gap: 12 },
    children,
  };
}

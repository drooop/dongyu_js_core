#!/usr/bin/env node

import assert from 'node:assert/strict';
import { buildFilltableModelInventoryFromSnapshot } from '../../packages/ui-model-demo-server/filltable_prompt_context.mjs';

const snapshot = {
  models: {
    1: {
      id: 1,
      name: 'Model 1',
      cells: {
        '0,0,0': {
          labels: {
            title: { k: 'title', t: 'str', v: 'Workspace Model 1' },
            app_name: { k: 'app_name', t: 'str', v: 'Model 1' },
          },
        },
        '1,0,0': {
          labels: {
            _title: { k: '_title', t: 'str', v: 'Model 1' },
            _field_order: { k: '_field_order', t: 'json', v: ['title'] },
            title: { k: 'title', t: 'str', v: 'Input' },
            title__label: { k: 'title__label', t: 'str', v: '标题' },
          },
        },
      },
    },
    1001: {
      id: 1001,
      name: 'leave-form',
      cells: {
        '0,0,0': {
          labels: {
            applicant: { k: 'applicant', t: 'str', v: '' },
            leave_type: { k: 'leave_type', t: 'str', v: '' },
            days: { k: 'days', t: 'int', v: 1 },
            reason: { k: 'reason', t: 'str', v: '' },
            app_name: { k: 'app_name', t: 'str', v: '请假申请' },
          },
        },
        '1,0,0': {
          labels: {
            _title: { k: '_title', t: 'str', v: '请假申请表' },
            _field_order: { k: '_field_order', t: 'json', v: ['applicant', 'leave_type', 'days', 'reason'] },
            applicant: { k: 'applicant', t: 'str', v: 'Input' },
            applicant__label: { k: 'applicant__label', t: 'str', v: '姓名' },
            leave_type: { k: 'leave_type', t: 'str', v: 'Select' },
            leave_type__label: { k: 'leave_type__label', t: 'str', v: '假别' },
            leave_type__opts: {
              k: 'leave_type__opts',
              t: 'json',
              v: [
                { label: '年假', value: 'annual' },
                { label: '事假', value: 'personal' },
                { label: '病假', value: 'sick' },
              ],
            },
            days: { k: 'days', t: 'str', v: 'NumberInput' },
            days__label: { k: 'days__label', t: 'str', v: '天数' },
            reason: { k: 'reason', t: 'str', v: 'Input' },
            reason__label: { k: 'reason__label', t: 'str', v: '事由' },
          },
        },
      },
    },
    1002: {
      id: 1002,
      name: 'repair-form',
      cells: {
        '0,0,0': {
          labels: {
            device_name: { k: 'device_name', t: 'str', v: '' },
            location: { k: 'location', t: 'str', v: '' },
            urgency: { k: 'urgency', t: 'str', v: '' },
            description: { k: 'description', t: 'str', v: '' },
            app_name: { k: 'app_name', t: 'str', v: '设备报修' },
          },
        },
        '1,0,0': {
          labels: {
            _title: { k: '_title', t: 'str', v: '设备报修单' },
            _field_order: { k: '_field_order', t: 'json', v: ['device_name', 'location', 'urgency', 'description'] },
            device_name: { k: 'device_name', t: 'str', v: 'Input' },
            device_name__label: { k: 'device_name__label', t: 'str', v: '设备名称' },
            urgency: { k: 'urgency', t: 'str', v: 'RadioGroup' },
            urgency__label: { k: 'urgency__label', t: 'str', v: '紧急程度' },
            urgency__opts: {
              k: 'urgency__opts',
              t: 'json',
              v: [
                { label: '低', value: 'low' },
                { label: '中', value: 'medium' },
                { label: '高', value: 'high' },
              ],
            },
          },
        },
      },
    },
  },
};

const inventory = buildFilltableModelInventoryFromSnapshot(snapshot, 16);

assert.equal(inventory.length, 3, 'inventory must include all positive models in range');

const leaveModel = inventory.find((item) => item.model_id === 1001);
assert.ok(leaveModel, 'leave model inventory missing');
assert.equal(leaveModel.schema_title, '请假申请表');
assert.deepEqual(
  leaveModel.schema_fields.map((item) => item.key),
  ['applicant', 'leave_type', 'days', 'reason'],
  'leave model field order must follow _field_order',
);
assert.equal(leaveModel.schema_fields[0].ui_label, '姓名');
assert.equal(leaveModel.schema_fields[1].key, 'leave_type');
assert.deepEqual(
  leaveModel.schema_fields[1].options,
  [
    { label: '年假', value: 'annual' },
    { label: '事假', value: 'personal' },
    { label: '病假', value: 'sick' },
  ],
  'leave type options must be preserved for prompt-time enum mapping',
);
assert.equal(leaveModel.schema_fields[2].value_type, 'int');

const repairModel = inventory.find((item) => item.model_id === 1002);
assert.ok(repairModel, 'repair model inventory missing');
assert.ok(
  repairModel.schema_fields.some((item) => item.key === 'device_name' && item.ui_label === '设备名称'),
  'repair model inventory must expose device_name schema field',
);
assert.deepEqual(
  repairModel.schema_fields.find((item) => item.key === 'urgency')?.options,
  [
    { label: '低', value: 'low' },
    { label: '中', value: 'medium' },
    { label: '高', value: 'high' },
  ],
  'urgency options must be available for canonical value mapping',
);

console.log('test_0188_filltable_prompt_context: PASS');

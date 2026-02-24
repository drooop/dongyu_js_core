import { createHash } from 'node:crypto';

const DEFAULT_ALLOWED_LABEL_TYPES = ['str', 'int', 'float', 'bool', 'json', 'event'];
const DEFAULT_PROTECTED_LABEL_KEYS = [
  'ui_event',
  'ui_event_error',
  'ui_event_last_op_id',
  'intent.v0',
  'snapshot_json',
  'event_log',
  'dual_bus_model',
  'run_mgmt_send',
  'run_intent_dispatch',
  'mgmt_inbox',
  'mgmt_func_error',
];

export const DEFAULT_FILLTABLE_POLICY = Object.freeze({
  allow_positive_model_ids: true,
  allow_negative_model_ids: false,
  max_records_per_apply: 10,
  max_value_bytes: 64 * 1024,
  max_total_bytes: 256 * 1024,
  allowed_label_types: DEFAULT_ALLOWED_LABEL_TYPES,
  protected_label_keys: DEFAULT_PROTECTED_LABEL_KEYS,
});

function readInt(value, fallback) {
  if (Number.isSafeInteger(value)) return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  return fallback;
}

function readNumber(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toStringSet(value, fallback) {
  const arr = Array.isArray(value) ? value : fallback;
  const out = [];
  const seen = new Set();
  for (const item of arr) {
    if (typeof item !== 'string') continue;
    const key = item.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function byteSize(value) {
  if (value === undefined) return 0;
  if (typeof value === 'string') return Buffer.byteLength(value, 'utf8');
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch (_) {
    return Number.POSITIVE_INFINITY;
  }
}

function normalizeTypedValue(typeName, rawValue) {
  if (typeName === 'str') {
    return { ok: true, value: String(rawValue ?? '') };
  }
  if (typeName === 'int') {
    const intValue = readInt(rawValue, null);
    if (!Number.isSafeInteger(intValue)) {
      return { ok: false, code: 'invalid_int_value' };
    }
    return { ok: true, value: intValue };
  }
  if (typeName === 'float') {
    const num = readNumber(rawValue, null);
    if (!Number.isFinite(num)) return { ok: false, code: 'invalid_float_value' };
    return { ok: true, value: num };
  }
  if (typeName === 'bool') {
    if (typeof rawValue === 'boolean') return { ok: true, value: rawValue };
    if (typeof rawValue === 'string') {
      const text = rawValue.trim().toLowerCase();
      if (text === 'true') return { ok: true, value: true };
      if (text === 'false') return { ok: true, value: false };
    }
    return { ok: false, code: 'invalid_bool_value' };
  }
  if (typeName === 'json' || typeName === 'event') {
    if (typeof rawValue === 'string') {
      const trimmed = rawValue.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          return { ok: true, value: JSON.parse(trimmed) };
        } catch (_) {
          return { ok: false, code: 'invalid_json_value' };
        }
      }
    }
    try {
      JSON.stringify(rawValue);
      return { ok: true, value: rawValue };
    } catch (_) {
      return { ok: false, code: 'invalid_json_value' };
    }
  }
  return { ok: false, code: 'invalid_label_type' };
}

function normalizeRecordBase(record) {
  const model_id = readInt(record && record.model_id, null);
  const p = readInt(record && record.p, null);
  const r = readInt(record && record.r, null);
  const c = readInt(record && record.c, null);
  const k = record && typeof record.k === 'string' ? record.k.trim() : '';
  if (!Number.isInteger(model_id)) return { ok: false, code: 'invalid_model_id' };
  if (!Number.isInteger(p) || !Number.isInteger(r) || !Number.isInteger(c)) {
    return { ok: false, code: 'invalid_coordinates' };
  }
  if (!k) return { ok: false, code: 'invalid_label_key' };
  return { ok: true, model_id, p, r, c, k };
}

export function normalizeFilltablePolicy(rawValue) {
  const raw = rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)
    ? rawValue
    : {};
  return {
    allow_positive_model_ids: raw.allow_positive_model_ids !== false,
    allow_negative_model_ids: raw.allow_negative_model_ids === true,
    max_records_per_apply: Math.max(1, Math.min(256, readInt(raw.max_records_per_apply, DEFAULT_FILLTABLE_POLICY.max_records_per_apply))),
    max_value_bytes: Math.max(256, Math.min(4 * 1024 * 1024, readInt(raw.max_value_bytes, DEFAULT_FILLTABLE_POLICY.max_value_bytes))),
    max_total_bytes: Math.max(1024, Math.min(16 * 1024 * 1024, readInt(raw.max_total_bytes, DEFAULT_FILLTABLE_POLICY.max_total_bytes))),
    allowed_label_types: toStringSet(raw.allowed_label_types, DEFAULT_FILLTABLE_POLICY.allowed_label_types),
    protected_label_keys: toStringSet(raw.protected_label_keys, DEFAULT_FILLTABLE_POLICY.protected_label_keys),
  };
}

export function validateFilltableRecords(recordsInput, policyInput) {
  const policy = normalizeFilltablePolicy(policyInput);
  const records = Array.isArray(recordsInput) ? recordsInput : [];
  const accepted_records = [];
  const rejected_records = [];
  const allowedTypeSet = new Set(policy.allowed_label_types);
  const protectedKeySet = new Set(policy.protected_label_keys);
  let accepted_total_bytes = 0;

  for (let i = 0; i < records.length; i += 1) {
    const source = records[i];
    const index = i;
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      rejected_records.push({ index, code: 'invalid_record', detail: 'record_not_object', record: source });
      continue;
    }
    if (i >= policy.max_records_per_apply) {
      rejected_records.push({ index, code: 'too_many_records', detail: `max_records_per_apply=${policy.max_records_per_apply}`, record: source });
      continue;
    }

    const op = typeof source.op === 'string' ? source.op.trim() : '';
    if (op !== 'add_label' && op !== 'rm_label') {
      rejected_records.push({ index, code: 'invalid_op', detail: 'only_add_label_or_rm_label', record: source });
      continue;
    }

    const base = normalizeRecordBase(source);
    if (!base.ok) {
      rejected_records.push({ index, code: base.code, detail: base.code, record: source });
      continue;
    }
    if (base.model_id > 0 && !policy.allow_positive_model_ids) {
      rejected_records.push({ index, code: 'model_id_not_allowed', detail: 'positive_model_id_forbidden', record: source });
      continue;
    }
    if (base.model_id < 0 && !policy.allow_negative_model_ids) {
      rejected_records.push({ index, code: 'model_id_not_allowed', detail: 'negative_model_id_forbidden', record: source });
      continue;
    }
    if (base.model_id === 0) {
      rejected_records.push({ index, code: 'model_id_not_allowed', detail: 'model_0_forbidden', record: source });
      continue;
    }
    if (protectedKeySet.has(base.k)) {
      rejected_records.push({ index, code: 'protected_label_key', detail: base.k, record: source });
      continue;
    }

    if (op === 'rm_label') {
      accepted_records.push({
        op: 'rm_label',
        model_id: base.model_id,
        p: base.p,
        r: base.r,
        c: base.c,
        k: base.k,
      });
      continue;
    }

    const t = typeof source.t === 'string' ? source.t.trim() : '';
    if (!allowedTypeSet.has(t)) {
      rejected_records.push({ index, code: 'label_type_not_allowed', detail: t || 'missing_t', record: source });
      continue;
    }

    const typed = normalizeTypedValue(t, source.v);
    if (!typed.ok) {
      rejected_records.push({ index, code: typed.code, detail: typed.code, record: source });
      continue;
    }
    const value_bytes = byteSize(typed.value);
    if (!Number.isFinite(value_bytes)) {
      rejected_records.push({ index, code: 'invalid_value', detail: 'json_stringify_failed', record: source });
      continue;
    }
    if (value_bytes > policy.max_value_bytes) {
      rejected_records.push({ index, code: 'value_too_large', detail: `max_value_bytes=${policy.max_value_bytes}`, record: source });
      continue;
    }
    if (accepted_total_bytes + value_bytes > policy.max_total_bytes) {
      rejected_records.push({ index, code: 'total_too_large', detail: `max_total_bytes=${policy.max_total_bytes}`, record: source });
      continue;
    }

    accepted_total_bytes += value_bytes;
    accepted_records.push({
      op: 'add_label',
      model_id: base.model_id,
      p: base.p,
      r: base.r,
      c: base.c,
      k: base.k,
      t,
      v: typed.value,
    });
  }

  return {
    accepted_records,
    rejected_records,
    stats: {
      requested: records.length,
      accepted: accepted_records.length,
      rejected: rejected_records.length,
      accepted_total_bytes,
    },
    policy,
  };
}

export function buildFilltableDigest(records) {
  const payload = Array.isArray(records) ? records : [];
  const text = JSON.stringify(payload);
  return createHash('sha256').update(text || '[]').digest('hex');
}

export function evaluateApplyPreviewGuard(input) {
  const requested = typeof (input && input.requested_preview_id) === 'string'
    ? input.requested_preview_id.trim()
    : '';
  const latest = typeof (input && input.latest_preview_id) === 'string'
    ? input.latest_preview_id.trim()
    : '';
  const lastApplied = typeof (input && input.last_applied_preview_id) === 'string'
    ? input.last_applied_preview_id.trim()
    : '';

  if (!requested) {
    return { ok: false, code: 'missing_preview_id', detail: 'missing_preview_id' };
  }
  if (!latest) {
    return { ok: false, code: 'missing_preview', detail: 'missing_preview' };
  }
  if (requested !== latest) {
    return { ok: false, code: 'stale_preview', detail: 'stale_preview' };
  }
  if (lastApplied && requested === lastApplied) {
    return { ok: false, code: 'preview_replay', detail: 'preview_replay' };
  }
  return { ok: true };
}

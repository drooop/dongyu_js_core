export const MAX_PIN_PAYLOAD_ENVELOPE_EXTENSION_KEYS = 16;
export const MAX_PIN_PAYLOAD_ENVELOPE_EXTENSION_KEY_LENGTH = 64;

export const PIN_PAYLOAD_ENVELOPE_EXTENSION_RESERVED_EXACT_KEYS = Object.freeze([
  '__mt_payload_kind',
  '__mt_request_id',
  'op_id',
  'request_id',
  'correlation_id',
  'message_role',
  'bus',
  'bus_out_key',
  'route_kind',
  'topic',
  'response_topic',
  'timestamp',
  'payload',
  'payload_model_id',
  'bundle_record_id_offset',
  'worker_id',
  'model_id',
  'table_id',
  'pin',
  'principal_ref',
  'principal_id',
  'authority',
  'identity',
  'source_model_id',
  'route',
  'reply_to',
  'route.reply_to',
  'response_pin',
  'return_topic',
  'returnTopic',
  'result_topic',
  'envelope_extension_keys',
]);

export const PIN_PAYLOAD_ENVELOPE_EXTENSION_RESERVED_PREFIXES = Object.freeze([
  '__mt_',
  'endpoint_',
  'origin_',
  'reply_target_',
  'principal_',
  'owner_',
  'payload_',
  'response_',
  'return_',
  'route_',
  'source_',
  'model_',
  'sys_',
]);

export const PIN_PAYLOAD_ENVELOPE_EXTENSION_KEY_PATTERN = /^[a-z][a-z0-9_]*$/u;

const exactKeySet = new Set(PIN_PAYLOAD_ENVELOPE_EXTENSION_RESERVED_EXACT_KEYS);

function invalidExtensionKeys(reason, key = null) {
  return {
    ok: false,
    code: 'invalid_envelope_extension_keys',
    reason,
    ...(key === null ? {} : { key }),
  };
}

export function validatePinPayloadEnvelopeExtensionKeys(value) {
  if (!Array.isArray(value)) return invalidExtensionKeys('invalid_collection');
  if (value.length > MAX_PIN_PAYLOAD_ENVELOPE_EXTENSION_KEYS) return invalidExtensionKeys('too_many_keys');

  const keys = [];
  const seen = new Set();
  for (const key of value) {
    if (typeof key !== 'string') return invalidExtensionKeys('invalid_key');
    if (seen.has(key)) return invalidExtensionKeys('duplicate_key', key);
    if (
      exactKeySet.has(key)
      || PIN_PAYLOAD_ENVELOPE_EXTENSION_RESERVED_PREFIXES.some((prefix) => key.startsWith(prefix))
    ) return invalidExtensionKeys('reserved_key', key);
    if (
      key.length === 0
      || key.length > MAX_PIN_PAYLOAD_ENVELOPE_EXTENSION_KEY_LENGTH
      || !PIN_PAYLOAD_ENVELOPE_EXTENSION_KEY_PATTERN.test(key)
    ) return invalidExtensionKeys('invalid_key', key);
    seen.add(key);
    keys.push(key);
  }

  return { ok: true, keys };
}

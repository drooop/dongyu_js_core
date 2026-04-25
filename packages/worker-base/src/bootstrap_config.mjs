function getModel0Cell(runtime) {
  if (!runtime || typeof runtime.getModel !== 'function' || typeof runtime.getCell !== 'function') return null;
  const model0 = runtime.getModel(0);
  if (!model0) return null;
  return runtime.getCell(model0, 0, 0, 0);
}

function getLabel(cell, key) {
  if (!cell || !cell.labels || typeof cell.labels.get !== 'function') return null;
  return cell.labels.get(key) || null;
}

function readTypedLabelValue(cell, key, typeName) {
  const label = getLabel(cell, key);
  if (!label) return null;
  if (typeName && label.t !== typeName) return null;
  return label.v ?? null;
}

function readStringValue(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function readFirstArrayString(value) {
  if (!Array.isArray(value)) return '';
  for (const item of value) {
    const text = readStringValue(item);
    if (text) return text;
  }
  return '';
}

function readIntFromArray(value) {
  const raw = readFirstArrayString(value);
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export function readMatrixBootstrapConfig(runtime) {
  const cell = getModel0Cell(runtime);
  const roomId = readStringValue(readTypedLabelValue(cell, 'matrix_room_id', null));
  const homeserverUrl = readStringValue(readTypedLabelValue(cell, 'matrix_server', 'matrix.server'));
  const userId = readStringValue(readTypedLabelValue(cell, 'matrix_user', 'matrix.user'));
  const accessToken = readStringValue(readTypedLabelValue(cell, 'matrix_token', 'matrix.token'));
  const password = readStringValue(readTypedLabelValue(cell, 'matrix_passwd', 'matrix.passwd'));
  const peerUserId = readFirstArrayString(readTypedLabelValue(cell, 'matrix_contuser', 'matrix.contuser'));
  return {
    roomId: roomId || null,
    homeserverUrl: homeserverUrl || null,
    userId: userId || null,
    accessToken: accessToken || null,
    password: password || null,
    peerUserId: peerUserId || null,
  };
}

export function readMqttBootstrapConfig(runtime) {
  const cell = getModel0Cell(runtime);
  const localHost = readFirstArrayString(readTypedLabelValue(cell, 'local_ip', 'mqtt.local.ip'));
  const globalHost = readFirstArrayString(readTypedLabelValue(cell, 'global_ip', 'mqtt.global.ip'));
  const localPort = readIntFromArray(readTypedLabelValue(cell, 'local_port', 'mqtt.local.port'));
  const globalPort = readIntFromArray(readTypedLabelValue(cell, 'global_port', 'mqtt.global.port'));
  return {
    host: localHost || globalHost || null,
    port: localPort ?? globalPort ?? null,
  };
}

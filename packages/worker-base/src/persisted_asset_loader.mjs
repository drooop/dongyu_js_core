import fs from 'node:fs';
import path from 'node:path';

export function resolvePersistedAssetRoot(explicitRoot = undefined) {
  const raw = explicitRoot || process.env.DY_PERSISTED_ASSET_ROOT || '';
  if (!raw) return null;
  return path.resolve(String(raw));
}

export function readPersistedAssetManifest(assetRoot) {
  if (!assetRoot) {
    throw new Error('persisted_asset_root_required');
  }
  const manifestPath = path.join(assetRoot, 'manifest.v0.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`missing_persisted_asset_manifest:${manifestPath}`);
  }
  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!parsed || parsed.version !== 'dy.asset_manifest.v0' || !Array.isArray(parsed.entries)) {
    throw new Error(`invalid_persisted_asset_manifest:${manifestPath}`);
  }
  return parsed;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function matchesScope(entry, scope) {
  const scopes = normalizeArray(entry && entry.scope).map((item) => String(item));
  return scopes.includes(scope) || scopes.includes('*');
}

function matchesAuthority(entry, authority) {
  if (!authority) return true;
  return String(entry && entry.authority) === String(authority);
}

function matchesKind(entry, kind) {
  if (!kind) return true;
  return String(entry && entry.kind) === String(kind);
}

function matchesPhases(entry, phases) {
  if (!phases || phases.length === 0) return true;
  return phases.includes(String(entry && entry.phase));
}

function compareEntries(a, b) {
  const phaseA = String(a && a.phase ? a.phase : '');
  const phaseB = String(b && b.phase ? b.phase : '');
  if (phaseA !== phaseB) return phaseA.localeCompare(phaseB);
  const pathA = String(a && a.path ? a.path : '');
  const pathB = String(b && b.path ? b.path : '');
  if (pathA !== pathB) return pathA.localeCompare(pathB);
  return String(a && a.id ? a.id : '').localeCompare(String(b && b.id ? b.id : ''));
}

export function selectPersistedAssetEntries(manifest, options = {}) {
  if (!manifest || !Array.isArray(manifest.entries)) {
    throw new Error('invalid_persisted_asset_manifest_object');
  }
  const scope = options.scope ? String(options.scope) : '';
  const authority = options.authority ? String(options.authority) : '';
  const kind = options.kind ? String(options.kind) : '';
  const phases = normalizeArray(options.phases).map((phase) => String(phase));
  return manifest.entries
    .filter((entry) => !scope || matchesScope(entry, scope))
    .filter((entry) => matchesAuthority(entry, authority))
    .filter((entry) => matchesKind(entry, kind))
    .filter((entry) => matchesPhases(entry, phases))
    .sort(compareEntries);
}

function filterPatchRecords(records, mode) {
  const filter = String(mode || 'full');
  if (filter === 'full') return records;
  if (filter === 'negative-only') {
    return records.filter((record) => record && Number.isInteger(record.model_id) && record.model_id < 0);
  }
  if (filter === 'positive-only') {
    return records.filter((record) => record && Number.isInteger(record.model_id) && record.model_id > 0);
  }
  throw new Error(`unsupported_persisted_asset_filter:${filter}`);
}

function loadPatchFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [parsed];
}

export function applyPersistedAssetEntries(runtime, options = {}) {
  if (!runtime) {
    throw new Error('runtime_required');
  }
  const assetRoot = resolvePersistedAssetRoot(options.assetRoot);
  const manifest = options.manifest || readPersistedAssetManifest(assetRoot);
  const entries = selectPersistedAssetEntries(manifest, options);
  const applyOptions = options.applyOptions || { allowCreateModel: true, trustedBootstrap: true };

  let entriesApplied = 0;
  let patchObjectsApplied = 0;
  let recordCount = 0;

  for (const entry of entries) {
    const relativePath = String(entry.path || '');
    const filePath = path.join(assetRoot, relativePath);
    const required = entry.required !== false;
    if (!fs.existsSync(filePath)) {
      if (required) throw new Error(`missing_persisted_asset_file:${filePath}`);
      continue;
    }

    if (String(entry.kind) !== 'patch') continue;
    const patches = loadPatchFile(filePath);
    entriesApplied += 1;

    for (const patch of patches) {
      if (!patch || !Array.isArray(patch.records)) continue;
      const filteredRecords = filterPatchRecords(patch.records, entry.filter);
      if (filteredRecords.length === 0) continue;
      recordCount += filteredRecords.length;
      runtime.applyPatch({ ...patch, records: filteredRecords }, applyOptions);
      patchObjectsApplied += 1;
    }
  }

  return {
    assetRoot,
    entriesApplied,
    patchObjectsApplied,
    recordCount,
  };
}

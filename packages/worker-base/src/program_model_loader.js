'use strict';

const fs = require('node:fs');

let Database = null;
try {
  ({ Database } = require('bun:sqlite'));
} catch (_) {
  Database = null;
}

function ensureSqlite() {
  if (!Database) {
    throw new Error('bun:sqlite is required for program model loader');
  }
}

function normalizeValue(value) {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (_) {
    return value;
  }
}

function normalizeInt(value) {
  if (Number.isInteger(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const asNumber = Number(value);
    if (Number.isInteger(asNumber)) {
      return asNumber;
    }
  }
  return value;
}

function tableSql(db) {
  const row = db.query("select sql from sqlite_master where type='table' and name='mt_data'").get();
  return row?.sql || '';
}

function hasRowId(db) {
  const sql = tableSql(db).toUpperCase();
  return !sql.includes('WITHOUT ROWID');
}

function tableColumns(db) {
  try {
    return db.query('pragma table_info(mt_data)').all().map((row) => row.name);
  } catch (_) {
    return [];
  }
}

function modelTypeKey(tableId, modelId) {
  return `${tableId}|${modelId}`;
}

function loadProgramModelFromSqlite({
  runtime,
  dbPath,
  includeModelId = () => true,
  includeRecord = () => true,
}) {
  ensureSqlite();
  if (!runtime) {
    throw new Error('runtime is required');
  }
  if (!dbPath) {
    throw new Error('dbPath is required');
  }

  if (!fs.existsSync(dbPath)) {
    throw new Error(`db not found: ${dbPath}`);
  }

  const db = new Database(dbPath, { readonly: true });
  const rowIdEnabled = hasRowId(db);
  const hasTableId = tableColumns(db).includes('table_id');
  const tableIdExpr = hasTableId ? 'table_id' : "'host' as table_id";

  const modelTypeRows = db.query(`select ${tableIdExpr}, mt_id, v from mt_data where k='model_type'`).all();
  const modelTypes = new Map();
  for (const row of modelTypeRows) {
    if (typeof row.v === 'string' && row.v.length > 0) {
      modelTypes.set(modelTypeKey(row.table_id, row.mt_id), row.v);
    }
  }

  const modelRows = db.query(`select distinct ${tableIdExpr}, mt_id from mt_data order by table_id, mt_id`).all();
  for (const row of modelRows) {
    const modelId = row.mt_id;
    if (!includeModelId(modelId)) continue;
    const name = modelId === 0 ? 'MT' : `MT_${modelId}`;
    const type = modelTypes.get(modelTypeKey(row.table_id, modelId)) || (modelId === 0 ? 'main' : 'generic');
    runtime.createModel({ table_id: row.table_id, id: modelId, name, type });
  }

  const previousRunLoop = typeof runtime.isRunLoopActive === 'function' ? runtime.isRunLoopActive() : true;
  if (typeof runtime.setRunLoopActive === 'function') {
    runtime.setRunLoopActive(false);
  }

  const orderBy = rowIdEnabled
    ? 'table_id, mt_id, p, r, c, k, t, rowid'
    : 'table_id, mt_id, p, r, c, k, t';
  const selectRowId = rowIdEnabled ? 'rowid,' : '';
  const rows = db
    .query(`select ${selectRowId} ${tableIdExpr}, mt_id, p, r, c, k, t, v from mt_data order by ${orderBy}`)
    .all();

  for (const row of rows) {
    if (!includeModelId(row.mt_id)) continue;
    if (!includeRecord({
      tableId: row.table_id,
      table_id: row.table_id,
      modelRef: { table_id: row.table_id, model_id: row.mt_id },
      modelId: row.mt_id,
      p: normalizeInt(row.p),
      r: normalizeInt(row.r),
      c: normalizeInt(row.c),
      k: row.k,
      t: row.t,
    })) continue;
    const model = runtime.getModel({ table_id: row.table_id, model_id: row.mt_id }) || runtime.createModel({
      table_id: row.table_id,
      id: row.mt_id,
      name: row.mt_id === 0 ? 'MT' : `MT_${row.mt_id}`,
      type: modelTypes.get(modelTypeKey(row.table_id, row.mt_id)) || (row.mt_id === 0 ? 'main' : 'generic'),
    });

    const label = {
      k: row.k,
      t: row.t,
      v: normalizeValue(row.v),
    };
    const p = normalizeInt(row.p);
    const r = normalizeInt(row.r);
    const c = normalizeInt(row.c);
    runtime.addLabel(model, p, r, c, label);
  }

  if (typeof runtime.setRunLoopActive === 'function') {
    runtime.setRunLoopActive(previousRunLoop);
  }

  const errors = runtime.eventLog.list().filter((event) => event.op === 'error').length;

  if (typeof db.close === 'function') {
    db.close();
  }

  return {
    models: modelRows.length,
    rows: rows.length,
    errors,
    replayOrder: rowIdEnabled ? 'mt_id,p,r,c,k,t,rowid' : 'mt_id,p,r,c,k,t',
    valueParse: 'json-if-string',
    rowIdEnabled,
  };
}

module.exports = {
  loadProgramModelFromSqlite,
};

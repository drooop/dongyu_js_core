'use strict';

const fs = require('node:fs');
const path = require('node:path');

let Database = null;
try {
  ({ Database } = require('bun:sqlite'));
} catch (_) {
  Database = null;
}

function ensureSqlite() {
  if (!Database) {
    throw new Error('bun:sqlite is required for sqlite persistence');
  }
}

function ensureDir(fp) {
  const dir = path.dirname(fp);
  fs.mkdirSync(dir, { recursive: true });
}

const HOST_TABLE_ID = 'host';

function createTable(db, tableName) {
  db.query(`
    create table if not exists ${tableName} (
      table_id text not null default 'host',
      mt_id integer,
      p integer,
      r integer,
      c integer,
      k text,
      t text,
      v text,
      s text,
      i integer,
      m text,
      primary key (table_id, mt_id, p, r, c, k, t)
    ) without rowid
  `).run();
}

function tableColumns(db, tableName) {
  try {
    return db.query(`pragma table_info(${tableName})`).all().map((row) => row.name);
  } catch (_) {
    return [];
  }
}

function ensureSchema(db) {
  const existing = tableColumns(db, 'mt_data');
  if (existing.length === 0) {
    createTable(db, 'mt_data');
    return;
  }
  if (existing.includes('table_id')) {
    return;
  }
  db.query('begin immediate').run();
  try {
    db.query('drop table if exists mt_data_0425').run();
    createTable(db, 'mt_data_0425');
    db.query(`
      insert or replace into mt_data_0425 (table_id, mt_id, p, r, c, k, t, v, s, i, m)
      select 'host', mt_id, p, r, c, k, t, v, s, i, m from mt_data
    `).run();
    db.query('drop table mt_data').run();
    db.query('alter table mt_data_0425 rename to mt_data').run();
    db.query('commit').run();
  } catch (err) {
    try { db.query('rollback').run(); } catch (_) { /* ignore rollback errors */ }
    throw err;
  }
}

function encodeValue(value) {
  return JSON.stringify(value);
}

function modelTableId(model) {
  return model && typeof model.table_id === 'string' && model.table_id.trim()
    ? model.table_id.trim()
    : HOST_TABLE_ID;
}

class SqlitePersister {
  constructor({ dbPath }) {
    ensureSqlite();
    if (!dbPath) {
      throw new Error('dbPath is required');
    }
    ensureDir(dbPath);
    this.db = new Database(dbPath);
    ensureSchema(this.db);
    this.enabled = true;
    this.insertStmt = this.db.prepare(
      'insert or replace into mt_data (table_id, mt_id, p, r, c, k, t, v, s, i, m) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    this.deleteStmt = this.db.prepare(
      'delete from mt_data where table_id = ? and mt_id = ? and p = ? and r = ? and c = ? and k = ?',
    );
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }

  ensureModel(model) {
    if (!model || typeof model.id !== 'number') return;
    if (!this.enabled) return;
    const type = model.type || (model.id === 0 ? 'main' : 'generic');
    this.insertStmt.run(modelTableId(model), model.id, 0, 0, 0, 'model_type', 'str', encodeValue(type), null, null, null);
  }

  onLabelAdded({ model, p, r, c, label }) {
    if (!this.enabled) return;
    if (!model || !label) return;
    const tableId = modelTableId(model);
    this.deleteStmt.run(tableId, model.id, p, r, c, label.k);
    this.insertStmt.run(tableId, model.id, p, r, c, label.k, label.t, encodeValue(label.v), null, null, null);
  }

  onLabelRemoved({ model, p, r, c, label }) {
    if (!this.enabled) return;
    if (!model || !label) return;
    this.deleteStmt.run(modelTableId(model), model.id, p, r, c, label.k);
  }

  close() {
    if (this.db && typeof this.db.close === 'function') {
      this.db.close();
    }
  }
}

function createSqlitePersister(options) {
  return new SqlitePersister(options || {});
}

module.exports = {
  createSqlitePersister,
};

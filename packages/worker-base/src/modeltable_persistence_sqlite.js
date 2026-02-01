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

function ensureSchema(db) {
  db.query(`
    create table if not exists mt_data (
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
      primary key (mt_id, p, r, c, k, t)
    ) without rowid
  `).run();
}

function encodeValue(value) {
  return JSON.stringify(value);
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
      'insert or replace into mt_data (mt_id, p, r, c, k, t, v, s, i, m) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    this.deleteStmt = this.db.prepare(
      'delete from mt_data where mt_id = ? and p = ? and r = ? and c = ? and k = ? and t = ?',
    );
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }

  ensureModel(model) {
    if (!model || typeof model.id !== 'number') return;
    if (!this.enabled) return;
    const type = model.type || (model.id === 0 ? 'main' : 'generic');
    this.insertStmt.run(model.id, 0, 0, 0, 'model_type', 'str', encodeValue(type), null, null, null);
  }

  onLabelAdded({ model, p, r, c, label }) {
    if (!this.enabled) return;
    if (!model || !label) return;
    this.insertStmt.run(model.id, p, r, c, label.k, label.t, encodeValue(label.v), null, null, null);
  }

  onLabelRemoved({ model, p, r, c, label }) {
    if (!this.enabled) return;
    if (!model || !label) return;
    this.deleteStmt.run(model.id, p, r, c, label.k, label.t);
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

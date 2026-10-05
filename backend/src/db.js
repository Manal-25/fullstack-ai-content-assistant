import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultPath = fileURLToPath(new URL('../data/entries.sqlite', import.meta.url));

export function openDatabase(filename = defaultPath) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.exec(`CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_text TEXT NOT NULL,
    summary TEXT NOT NULL,
    tags TEXT NOT NULL CHECK(json_valid(tags) AND json_array_length(tags) = 3),
    created_at TEXT NOT NULL
  )`);
  return db;
}

function toEntry(row) {
  return row && { id: row.id, originalText: row.original_text, summary: row.summary,
    tags: JSON.parse(row.tags), createdAt: row.created_at };
}

export function entryRepository(db) {
  const insert = db.prepare('INSERT INTO entries (original_text, summary, tags, created_at) VALUES (?, ?, ?, ?)');
  const find = db.prepare('SELECT * FROM entries WHERE id = ?');
  const list = db.prepare('SELECT * FROM entries ORDER BY id DESC');
  return {
    list: () => list.all().map(toEntry),
    find: id => toEntry(find.get(id)),
    create(text, { summary, tags }) {
      const result = insert.run(text, summary, JSON.stringify(tags), new Date().toISOString());
      return toEntry(find.get(result.lastInsertRowid));
    },
  };
}

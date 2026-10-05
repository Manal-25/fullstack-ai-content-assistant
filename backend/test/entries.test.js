import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db.js';
import { AppError } from '../src/errors.js';

const output = { summary: 'The team will launch after testing.', tags: ['launch', 'testing', 'planning'] };

test('create, list, and open an entry after the database has been closed and reopened', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'briefly-test-'));
  const filename = join(directory, 'entries.sqlite');
  let db = openDatabase(filename);
  try {
    const app = createApp({ db, summarize: async () => output });
    const created = await request(app).post('/entries').send({ text: '  Launch after testing.  ' }).expect(201);
    assert.equal(created.body.originalText, 'Launch after testing.');
    assert.deepEqual(created.body.tags, output.tags);
    assert.ok(created.body.createdAt);
    db.close();
    db = openDatabase(filename);
    const reopened = createApp({ db, summarize: async () => output });
    const list = await request(reopened).get('/entries').expect(200);
    assert.deepEqual(list.body, [created.body]);
    const detail = await request(reopened).get(`/entries/${created.body.id}`).expect(200);
    assert.deepEqual(detail.body, created.body);
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('invalid input is rejected before calling the AI', async () => {
  const db = openDatabase(':memory:');
  let calls = 0;
  const app = createApp({ db, summarize: async () => { calls++; return output; } });
  try {
    for (const body of [{ text: '   ' }, { text: 'a'.repeat(12001) }, {}, { text: 42 }]) {
      await request(app).post('/entries').send(body).expect(400);
    }
    assert.equal(calls, 0);
    assert.deepEqual((await request(app).get('/entries')).body, []);
  } finally { db.close(); }
});

test('AI timeout returns a useful error without saving a partial entry', async () => {
  const db = openDatabase(':memory:');
  try {
    const app = createApp({ db, summarize: async () => { throw new AppError(504, 'The AI took too long. Please try again.'); } });
    const result = await request(app).post('/entries').send({ text: 'A meeting note.' }).expect(504);
    assert.match(result.body.error, /try again/);
    assert.deepEqual((await request(app).get('/entries')).body, []);
  } finally { db.close(); }
});

test('malformed output and duplicate tags cannot be persisted', async () => {
  const db = openDatabase(':memory:');
  try {
    for (const invalid of [{ ...output, tags: ['one', 'two'] }, { ...output, summary: ' ' }, { ...output, tags: ['launch', 'Launch', 'testing'] }]) {
      const app = createApp({ db, summarize: async () => invalid });
      await request(app).post('/entries').send({ text: 'A meeting note.' }).expect(502);
      assert.deepEqual((await request(app).get('/entries')).body, []);
    }
  } finally { db.close(); }
});

test('unknown entries and invalid JSON return JSON errors', async () => {
  const db = openDatabase(':memory:');
  try {
    const app = createApp({ db, summarize: async () => output });
    await request(app).get('/entries/999').expect(404);
    await request(app).get('/entries/not-a-number').expect(400);
    const result = await request(app).post('/entries').set('Content-Type', 'application/json').send('{').expect(400);
    assert.match(result.body.error, /valid JSON/);
  } finally { db.close(); }
});

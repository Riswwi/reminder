const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../docs/google-drive-backup.gs'), 'utf8');

function scriptFor(pages) {
  const requested = [];
  const context = vm.createContext({
    Date, Set, Map, JSON, Number, Object, Error, console,
    ScriptApp: { getOAuthToken: () => 'test-oauth-token' },
    UrlFetchApp: {
      fetch(url, options) {
        requested.push({ url, options });
        const page = pages.shift();
        assert.ok(page, 'unexpected extra page');
        return {
          getResponseCode: () => page.status || 200,
          getContentText: () => JSON.stringify(page.body),
        };
      },
    },
  });
  vm.runInContext(source, context);
  return { context, requested };
}

test('Drive reads every Firestore page directly and preserves task fields', () => {
  const { context, requested } = scriptFor([
    { body: { documents: [{ name: 'projects/reminder-60e25/databases/(default)/documents/tasks/1', fields: {
      title: { stringValue: 'Первое' },
      checklist: { arrayValue: { values: [{ mapValue: { fields: { done: { booleanValue: true } } } }] } },
      count: { integerValue: '3' },
    } }], nextPageToken: 'next-page' } },
    { body: { documents: [{ name: 'projects/reminder-60e25/databases/(default)/documents/tasks/2', fields: {
      title: { stringValue: 'Второе' },
      note: { nullValue: null },
    } }] } },
  ]);
  const backup = context.readFirestoreBackup_();
  assert.equal(backup.format, 'todo-interval-tasks');
  assert.equal(backup.tasks.length, 2);
  assert.equal(backup.tasks[0].data.checklist[0].done, true);
  assert.equal(backup.tasks[0].data.count, 3);
  assert.equal(backup.tasks[1].data.note, null);
  assert.match(requested[0].url, /^https:\/\/firestore\.googleapis\.com\/v1\//);
  assert.match(requested[1].url, /pageToken=next-page/);
  assert.equal(requested[0].options.headers.Authorization, 'Bearer test-oauth-token');
});

test('Drive refuses empty or incomplete backups', () => {
  assert.throws(() => scriptFor([{ body: {} }]).context.readFirestoreBackup_(), /empty/);
  assert.throws(() => scriptFor([{ body: { documents: [{ name: 'projects/x/documents/tasks/1', fields: {
    title: { stringValue: 'Task' }, binary: { bytesValue: 'AQID' },
  } }] } }]).context.readFirestoreBackup_(), /unsupported Firestore value/);
  assert.throws(() => scriptFor([{ status: 403, body: {} }]).context.readFirestoreBackup_(), /HTTP 403/);
});

test('Vercel can request a daily fallback without becoming the Drive data source', () => {
  const { context } = scriptFor([]);
  const called = [];
  context.PropertiesService = { getScriptProperties: () => ({ getProperty: () => 'x'.repeat(32) }) };
  context.ContentService = {
    MimeType: { JSON: 'json' },
    createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }),
  };
  context.backupToDrive = daily => { called.push(daily); return { date: '2026-09-29' }; };
  const request = pathname => ({ postData: { contents: JSON.stringify({ token: 'x'.repeat(32), pathname }) } });
  assert.equal(context.doPost(request('todo-interval/automatic/2026-09-29.json')).ok, true);
  assert.equal(context.doPost(request('todo-interval/automatic/2026-09-29T12-00-00-000.json')).ok, true);
  assert.deepEqual(called, [true, false]);
  assert.equal(context.doPost(request('other-file.json')).ok, false);
  assert.doesNotMatch(source, /BACKUP_SOURCE|api\/backup\/latest/);
});

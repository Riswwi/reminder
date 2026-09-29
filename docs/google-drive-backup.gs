// Personal Apps Script: Google Drive reads Firestore directly, without Vercel Blob.
// Add the OAuth scopes listed in automatic-backups.md to appsscript.json.
// BACKUP_TOKEN and the Web app are optional; they only enable the in-app "create now" button.

const FIRESTORE_PROJECT = 'reminder-60e25';
const FIRESTORE_COLLECTION = 'tasks';
const BACKUP_FOLDER_NAME = 'To-Do Interval Backups';
const BACKUP_MARKER = 'todo-interval-automatic-backup-v1';
const MAX_BACKUPS = 30;
const MAX_BACKUP_BYTES = 200 * 1024 * 1024;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

function installDailyBackup() {
  removeLegacyDailyBackupTrigger();
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'dailyBackupToDrive')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('dailyBackupToDrive').timeBased().atHour(4).everyDays(1).create();
  console.log('Independent Google Drive daily trigger installed (around 04:00 in script timezone).');
}

function removeLegacyDailyBackupTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'backupToDrive')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
}

function dailyBackupToDrive() {
  return backupToDrive(true);
}

function doPost(e) {
  try {
    const input = JSON.parse(e.postData.contents);
    const token = PropertiesService.getScriptProperties().getProperty('BACKUP_TOKEN');
    if (!token || token.length < 32 || input.token !== token ||
        !/^todo-interval\/automatic\/\d{4}-\d{2}-\d{2}(?:T\d{2}-\d{2}-\d{2}-\d{3})?\.json$/.test(input.pathname || '')) {
      throw new Error('Unauthorized backup request.');
    }
    // Pathname chooses daily deduplication only; task data always comes from Firestore.
    const daily = /^todo-interval\/automatic\/\d{4}-\d{2}-\d{2}\.json$/.test(input.pathname);
    const result = backupToDrive(daily);
    return ContentService.createTextOutput(JSON.stringify({ ok: true, ...result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error('Backup request failed:', error);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Google Drive backup failed.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function backupToDrive(daily) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Another Google Drive backup is still running.');
  try {
    const props = PropertiesService.getScriptProperties();
    const folder = getBackupFolder_(props);
    const existing = listMarkedBackups_(folder);
    const today = new Date().toISOString().slice(0, 10);
    const dailyName = 'todo-interval-' + today + '.json';
    if (daily) {
      const savedToday = existing.find(file => file.getName() === dailyName && validSavedBackup_(file));
      if (savedToday) return { date: today, alreadySaved: true };
    }
    const backup = readFirestoreBackup_();
    const content = JSON.stringify(backup, null, 2);
    const date = backup.exportedAt.slice(0, 10);
    const name = daily ? dailyName : 'todo-interval-' + backup.exportedAt.slice(0, 23).replace(/[:.]/g, '-') + '.json';
    const blob = Utilities.newBlob(content, 'application/json', name);
    const expectedBytes = blob.getBytes().length;
    if (expectedBytes > MAX_FILE_BYTES) throw new Error('Backup is larger than 20 MB; old copies were preserved.');
    const saved = folder.createFile(blob);
    saved.setDescription(BACKUP_MARKER);
    if (saved.getSize() !== expectedBytes || saved.getBlob().getDataAsString('UTF-8') !== content) {
      throw new Error('Saved Google Drive file could not be verified; old files were preserved.');
    }
    const previous = existing.sort((a, b) => b.getName().localeCompare(a.getName()))[0];
    let safeToPrune = true;
    if (previous) {
      try {
        const oldBackup = JSON.parse(previous.getBlob().getDataAsString('UTF-8'));
        if (oldBackup.format !== 'todo-interval-tasks' || !Array.isArray(oldBackup.tasks)) throw new Error('Invalid older copy.');
        if (oldBackup.tasks.length >= 10 && backup.tasks.length < Math.ceil(oldBackup.tasks.length / 2)) safeToPrune = false;
      } catch (error) {
        console.error('Could not verify older copy; cleanup skipped:', error);
        safeToPrune = false;
      }
    }
    const removed = safeToPrune ? pruneDriveBackups_(folder) : 0;
    console.log('Saved ' + backup.tasks.length + ' tasks to Google Drive; older copies removed: ' + removed);
    return { date, tasks: backup.tasks.length, removed, cleanupSkipped: !safeToPrune };
  } finally {
    lock.releaseLock();
  }
}

function readFirestoreBackup_() {
  // A fixed read time keeps pagination on one snapshot. A small margin avoids clock skew.
  const readTime = new Date(Date.now() - 3000).toISOString();
  const base = 'https://firestore.googleapis.com/v1/projects/' + FIRESTORE_PROJECT +
    '/databases/(default)/documents/' + FIRESTORE_COLLECTION;
  const token = ScriptApp.getOAuthToken();
  const tasks = [];
  const ids = new Set();
  const seenTokens = new Set();
  let pageToken = '';
  do {
    const url = base + '?pageSize=200&readTime=' + encodeURIComponent(readTime) +
      (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    const response = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true,
    });
    if (response.getResponseCode() !== 200) {
      throw new Error('Direct Firestore read failed: HTTP ' + response.getResponseCode() +
        '. Check the Google account IAM role and Apps Script scopes.');
    }
    const page = JSON.parse(response.getContentText('UTF-8'));
    (page.documents || []).forEach(document => {
      const id = decodeURIComponent(document.name.slice(document.name.lastIndexOf('/') + 1));
      if (!/^(0|[1-9]\d*)$/.test(id) || !Number.isSafeInteger(Number(id)) || ids.has(id)) {
        throw new Error('Invalid or duplicate Firestore task ID.');
      }
      const data = decodeFields_(document.fields || {}, 0);
      if (typeof data.title !== 'string' || !data.title.trim()) throw new Error('Task has no title: ' + id);
      data.id = Number(id);
      tasks.push({ id, data });
      ids.add(id);
    });
    pageToken = page.nextPageToken || '';
    if (pageToken && seenTokens.has(pageToken)) throw new Error('Firestore pagination repeated a token.');
    seenTokens.add(pageToken);
  } while (pageToken);
  if (!tasks.length) throw new Error('Firestore task collection is empty; old copies were preserved.');
  return {
    format: 'todo-interval-tasks',
    version: 1,
    project: FIRESTORE_PROJECT,
    exportedAt: new Date().toISOString(),
    tasks,
  };
}

function decodeFields_(fields, depth) {
  if (depth > 30) throw new Error('Firestore task data is too deeply nested.');
  const result = {};
  Object.keys(fields).forEach(key => {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new Error('Unsafe task field.');
    result[key] = decodeValue_(fields[key], depth + 1);
  });
  return result;
}

function decodeValue_(value, depth) {
  if (Object.prototype.hasOwnProperty.call(value, 'nullValue')) return null;
  if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) return value.stringValue;
  if (Object.prototype.hasOwnProperty.call(value, 'booleanValue')) return value.booleanValue;
  if (Object.prototype.hasOwnProperty.call(value, 'integerValue')) {
    const number = Number(value.integerValue);
    if (!Number.isSafeInteger(number)) throw new Error('Task contains an unsafe integer.');
    return number;
  }
  if (Object.prototype.hasOwnProperty.call(value, 'doubleValue')) {
    const number = Number(value.doubleValue);
    if (!Number.isFinite(number)) throw new Error('Task contains a non-finite number.');
    return number;
  }
  if (Object.prototype.hasOwnProperty.call(value, 'arrayValue')) {
    return (value.arrayValue.values || []).map(item => decodeValue_(item, depth + 1));
  }
  if (Object.prototype.hasOwnProperty.call(value, 'mapValue')) {
    return decodeFields_(value.mapValue.fields || {}, depth + 1);
  }
  if (Object.prototype.hasOwnProperty.call(value, 'timestampValue')) {
    const milliseconds = Date.parse(value.timestampValue);
    if (!Number.isFinite(milliseconds)) throw new Error('Task contains an invalid timestamp.');
    const seconds = Math.floor(milliseconds / 1000);
    const fraction = /\.(\d+)Z$/.exec(value.timestampValue)?.[1] || '';
    return { _seconds: seconds, _nanoseconds: Number((fraction + '000000000').slice(0, 9)) };
  }
  // Fail closed: an unsupported Firestore type must not silently disappear from a backup.
  throw new Error('Task contains an unsupported Firestore value type.');
}

function getBackupFolder_(props) {
  const id = props.getProperty('BACKUP_FOLDER_ID');
  if (id) return DriveApp.getFolderById(id);
  const folder = DriveApp.createFolder(BACKUP_FOLDER_NAME);
  props.setProperty('BACKUP_FOLDER_ID', folder.getId());
  return folder;
}

function validSavedBackup_(file) {
  if (!file.getSize() || file.getSize() > MAX_FILE_BYTES) return false;
  try {
    const parsed = JSON.parse(file.getBlob().getDataAsString('UTF-8'));
    return parsed.format === 'todo-interval-tasks' && parsed.version === 1 &&
      parsed.project === FIRESTORE_PROJECT && Array.isArray(parsed.tasks) && parsed.tasks.length > 0;
  } catch {
    return false;
  }
}

function pruneDriveBackups_(folder) {
  const files = listMarkedBackups_(folder);
  files.sort((a, b) => b.getName().localeCompare(a.getName()));
  let retained = 0;
  let bytes = 0;
  let removed = 0;
  files.forEach(file => {
    const size = file.getSize();
    if (retained >= 3 && (retained >= MAX_BACKUPS || bytes + size > MAX_BACKUP_BYTES)) {
      // Permanently delete only marked files in this backup folder, after the new file was verified.
      deleteBackupFile_(file);
      removed += 1;
    } else {
      retained += 1;
      bytes += size;
    }
  });
  return removed;
}

function listMarkedBackups_(folder) {
  const files = [];
  const iterator = folder.getFiles();
  while (iterator.hasNext()) {
    const file = iterator.next();
    if (file.getDescription() === BACKUP_MARKER && /^todo-interval-\d{4}-\d{2}-\d{2}(?:T\d{2}-\d{2}-\d{2}-\d{3})?\.json$/.test(file.getName())) {
      files.push(file);
    }
  }
  return files;
}

function deleteBackupFile_(file) {
  const response = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(file.getId()), {
    method: 'delete',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Could not delete an old app backup: HTTP ' + response.getResponseCode());
  }
}

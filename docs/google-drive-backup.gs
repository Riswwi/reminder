// Paste this file into your private standalone script.google.com project.
// Set BACKUP_TOKEN in Script properties to the same CRON_SECRET as Vercel.
// Deploy as a Web app: Execute as me, Who has access: Anyone.
// The public endpoint requires the secret in the POST body; never put it in the URL or code.

const BACKUP_SOURCE = 'https://reminder-amber-theta.vercel.app/api/backup/latest';
const BACKUP_FOLDER_NAME = 'To-Do Interval Backups';
const BACKUP_MARKER = 'todo-interval-automatic-backup-v1';
const MAX_BACKUPS = 30;
const MAX_BACKUP_BYTES = 200 * 1024 * 1024;

function installDailyBackup() {
  throw new Error('Daily backups are now controlled by the Vercel cron. Deploy this script as a Web app instead.');
}

function removeLegacyDailyBackupTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'backupToDrive')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
}

function doPost(e) {
  try {
    const input = JSON.parse(e.postData.contents);
    const token = PropertiesService.getScriptProperties().getProperty('BACKUP_TOKEN');
    if (!token || token.length < 32 || input.token !== token ||
        !/^todo-interval\/automatic\/\d{4}-\d{2}-\d{2}(?:T\d{2}-\d{2}-\d{2}-\d{3})?\.json$/.test(input.pathname || '')) {
      throw new Error('Unauthorized backup request.');
    }
    const result = backupToDrive(input.pathname);
    return ContentService.createTextOutput(JSON.stringify({ ok: true, ...result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error('Backup request failed:', error);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Google Drive backup failed.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function backupToDrive(pathname) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Another Google Drive backup is still running.');
  try {
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty('BACKUP_TOKEN');
    if (!token || token.length < 32) throw new Error('BACKUP_TOKEN is not configured.');
    const source = pathname ? BACKUP_SOURCE + '?pathname=' + encodeURIComponent(pathname) : BACKUP_SOURCE;
    const response = UrlFetchApp.fetch(source, {
      method: 'get',
      headers: { Authorization: 'Bearer ' + token },
      followRedirects: false,
      muteHttpExceptions: true,
    });
    if (response.getResponseCode() !== 200) {
      throw new Error('Vercel backup download failed: HTTP ' + response.getResponseCode());
    }
    const content = response.getContentText('UTF-8');
    const backup = JSON.parse(content);
    if (backup.format !== 'todo-interval-tasks' || backup.version !== 1 ||
        backup.project !== 'reminder-60e25' || !Array.isArray(backup.tasks) || !backup.tasks.length ||
        !/^\d{4}-\d{2}-\d{2}T/.test(backup.exportedAt || '')) {
      throw new Error('The downloaded task backup is invalid or empty.');
    }
    const ageMs = Date.now() - new Date(backup.exportedAt).getTime();
    if (!Number.isFinite(ageMs) || ageMs < -300000 || ageMs > 2 * 60 * 60 * 1000) {
      throw new Error('Vercel backup is stale; Google Drive copy was not marked successful.');
    }
    const date = backup.exportedAt.slice(0, 10);
    const name = 'todo-interval-' + backup.exportedAt.slice(0, 23).replace(/[:.]/g, '-') + '.json';
    const blob = Utilities.newBlob(content, 'application/json', name);
    const expectedBytes = blob.getBytes().length;
    if (expectedBytes > 20 * 1024 * 1024) throw new Error('Backup is larger than 20 MB.');
    const folder = getBackupFolder_(props);
    const sameName = folder.getFilesByName(name);
    while (sameName.hasNext()) {
      const existing = sameName.next();
      if (existing.getDescription() === BACKUP_MARKER && existing.getSize() === expectedBytes) {
        const removed = pruneDriveBackups_(folder);
        console.log('Google Drive already has this date: ' + date + '; older copies removed: ' + removed);
        return { date, tasks: backup.tasks.length, alreadySaved: true };
      }
    }
    const saved = folder.createFile(blob);
    saved.setDescription(BACKUP_MARKER);
    if (saved.getSize() !== expectedBytes) {
      throw new Error('Saved Google Drive file size could not be verified; old files were preserved.');
    }
    const removed = pruneDriveBackups_(folder);
    console.log('Saved ' + backup.tasks.length + ' tasks to Google Drive; older copies removed: ' + removed);
    return { date, tasks: backup.tasks.length, removed };
  } finally {
    lock.releaseLock();
  }
}

function getBackupFolder_(props) {
  const id = props.getProperty('BACKUP_FOLDER_ID');
  if (id) return DriveApp.getFolderById(id);
  const folder = DriveApp.createFolder(BACKUP_FOLDER_NAME);
  props.setProperty('BACKUP_FOLDER_ID', folder.getId());
  return folder;
}

function pruneDriveBackups_(folder) {
  const files = [];
  const iterator = folder.getFiles();
  while (iterator.hasNext()) {
    const file = iterator.next();
    if (file.getDescription() === BACKUP_MARKER && /^todo-interval-\d{4}-\d{2}-\d{2}(?:T\d{2}-\d{2}-\d{2}-\d{3})?\.json$/.test(file.getName())) {
      files.push(file);
    }
  }
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

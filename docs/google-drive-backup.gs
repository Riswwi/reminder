// Paste this file into a private standalone project at script.google.com.
// In Project Settings -> Script properties, set BACKUP_TOKEN to the same
// CRON_SECRET configured for the Vercel project. Never paste the token in code.

const BACKUP_SOURCE = 'https://reminder-amber-theta.vercel.app/api/backup/latest';
const BACKUP_FOLDER_NAME = 'To-Do Interval Backups';
const BACKUP_MARKER = 'todo-interval-automatic-backup-v1';
const MAX_BACKUPS = 30;
const MAX_BACKUP_BYTES = 200 * 1024 * 1024;

function installDailyBackup() {
  const token = PropertiesService.getScriptProperties().getProperty('BACKUP_TOKEN');
  if (!token || token.length < 16) throw new Error('Set BACKUP_TOKEN in Script properties first.');
  if (!ScriptApp.getProjectTriggers().some(trigger => trigger.getHandlerFunction() === 'backupToDrive')) {
    ScriptApp.newTrigger('backupToDrive')
      .timeBased().everyDays(1).atHour(7).inTimezone('Europe/Warsaw').create();
  }
  console.log('The daily Google Drive backup trigger is installed.');
}

function backupToDrive() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty('BACKUP_TOKEN');
    if (!token || token.length < 16) throw new Error('BACKUP_TOKEN is not configured.');
    const response = UrlFetchApp.fetch(BACKUP_SOURCE, {
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
    const date = backup.exportedAt.slice(0, 10);
    if (date !== Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd')) {
      throw new Error('Vercel backup is stale; Google Drive copy was not marked successful.');
    }
    const name = 'todo-interval-' + date + '.json';
    const blob = Utilities.newBlob(content, 'application/json', name);
    const expectedBytes = blob.getBytes().length;
    if (expectedBytes > 20 * 1024 * 1024) throw new Error('Backup is larger than 20 MB.');
    const folder = getBackupFolder_(props);
    const sameName = folder.getFilesByName(name);
    while (sameName.hasNext()) {
      const existing = sameName.next();
      if (existing.getDescription() === BACKUP_MARKER && existing.getSize() === expectedBytes) {
        console.log('Google Drive already has this date: ' + date);
        return;
      }
    }
    const saved = folder.createFile(blob);
    saved.setDescription(BACKUP_MARKER);
    if (saved.getSize() !== expectedBytes) {
      throw new Error('Saved Google Drive file size could not be verified; old files were preserved.');
    }
    const removed = pruneDriveBackups_(folder);
    console.log('Saved ' + backup.tasks.length + ' tasks to Google Drive; older copies removed: ' + removed);
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
    if (file.getDescription() === BACKUP_MARKER && /^todo-interval-\d{4}-\d{2}-\d{2}\.json$/.test(file.getName())) {
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
      // Drive trash is automatically emptied by Google later. No other files are touched.
      file.setTrashed(true);
      removed += 1;
    } else {
      retained += 1;
      bytes += size;
    }
  });
  return removed;
}

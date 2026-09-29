export const AUTOMATIC_BACKUP_PREFIX = 'todo-interval/automatic/';
export const MAX_AUTOMATIC_BACKUPS = 30;
export const MAX_AUTOMATIC_BACKUP_BYTES = 200 * 1024 * 1024;

export const backupName = /^todo-interval\/automatic\/\d{4}-\d{2}-\d{2}(?:T\d{2}-\d{2}-\d{2}-\d{3})?\.json$/;

export function planBackupCleanup(blobs) {
  const sorted = blobs
    .filter(blob => backupName.test(blob.pathname))
    .sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0) || b.pathname.localeCompare(a.pathname));
  const remove = [];
  let retainedCount = 0;
  let retainedBytes = 0;
  for (const blob of sorted) {
    const size = Math.max(0, Number(blob.size) || 0);
    if (retainedCount >= 3 && (
      retainedCount >= MAX_AUTOMATIC_BACKUPS ||
      retainedBytes + size > MAX_AUTOMATIC_BACKUP_BYTES
    )) {
      remove.push(blob);
    } else {
      retainedCount += 1;
      retainedBytes += size;
    }
  }
  return { remove, retainedCount, retainedBytes };
}

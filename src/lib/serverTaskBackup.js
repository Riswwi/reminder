import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { del, get, head, list, put } from '@vercel/blob';
import { makeTaskBackup, parseTaskBackup } from './taskBackup';
import { AUTOMATIC_BACKUP_PREFIX, backupName, planBackupCleanup } from './automaticBackup';

export function backupConfigured() {
  return Boolean(process.env.CRON_SECRET && process.env.BLOB_READ_WRITE_TOKEN &&
    process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
}

export function driveConfigured() {
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(process.env.GOOGLE_BACKUP_WEBAPP_URL || '');
}

function backupDb() {
  const name = 'automatic-task-backup';
  const existing = getApps().find(app => app.name === name);
  const app = existing || initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  }, name);
  return getFirestore(app);
}

const BACKUP_CONTROL_PATH = 'todo-interval/config/backup-mode.json';

export async function getDailyEnabled() {
  const file = await get(BACKUP_CONTROL_PATH, { access: 'private', useCache: false });
  if (!file) return true;
  const config = JSON.parse(await new Response(file.stream).text());
  if (typeof config.dailyEnabled !== 'boolean') throw new Error('Invalid backup control file.');
  return config.dailyEnabled;
}

export async function setDailyEnabled(enabled) {
  const content = JSON.stringify({
    dailyEnabled: enabled,
    updatedAt: new Date().toISOString(),
  });
  const saved = await put(BACKUP_CONTROL_PATH, content, {
    access: 'private', addRandomSuffix: false, allowOverwrite: true,
    contentType: 'application/json',
  });
  const confirmed = await head(saved.url);
  if (confirmed.size !== Buffer.byteLength(content, 'utf8')) throw new Error('Backup control update could not be verified.');
}

export async function listAutomaticBackups() {
  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix: AUTOMATIC_BACKUP_PREFIX, limit: 1000, cursor });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
    if (page.hasMore && !cursor) throw new Error('Backup listing did not return a cursor.');
  } while (cursor);
  return blobs.filter(blob => backupName.test(blob.pathname))
    .sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0) || b.pathname.localeCompare(a.pathname));
}

export async function createTaskBackup({ daily = false } = {}) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const pathname = `${AUTOMATIC_BACKUP_PREFIX}${daily ? date : now.toISOString().slice(0, 23).replace(/[:.]/g, '-')}.json`;
  const previous = await listAutomaticBackups();
  if (daily) {
    const existing = previous.find(blob => blob.pathname === pathname);
    if (existing) {
      const confirmed = await head(existing.url);
      if (!confirmed?.size) throw new Error('Existing daily backup could not be verified.');
      return { date, pathname, alreadySaved: true, bytes: confirmed.size };
    }
  }

  const snapshot = await backupDb().collection('tasks').get();
  if (snapshot.empty) throw new Error('Task collection is empty; older backups were preserved.');
  const content = makeTaskBackup(snapshot.docs.map(item => ({ id: item.id, data: item.data() })));
  const contentBytes = Buffer.byteLength(content, 'utf8');

  let safeToPrune = true;
  if (previous.length) {
    try {
      const lastFile = await get(previous[0].url, { access: 'private', useCache: false });
      if (!lastFile?.stream) throw new Error('Previous backup is unavailable.');
      const lastBackup = parseTaskBackup(await new Response(lastFile.stream).text());
      if (lastBackup.tasks.length >= 10 && snapshot.size < Math.ceil(lastBackup.tasks.length / 2)) {
        safeToPrune = false;
      }
    } catch {
      safeToPrune = false;
    }
  }

  const saved = await put(pathname, content, {
    access: 'private', addRandomSuffix: false, contentType: 'application/json',
  });
  const confirmed = await head(saved.url);
  if (!confirmed || confirmed.size !== contentBytes) {
    throw new Error('Uploaded backup could not be verified; cleanup was skipped.');
  }

  let removed = 0;
  if (safeToPrune) {
    const cleanup = planBackupCleanup(await listAutomaticBackups());
    for (const old of cleanup.remove) {
      await del(old.url);
      removed += 1;
    }
  }
  return { date, pathname, tasks: snapshot.size, bytes: contentBytes, removed, cleanupSkipped: !safeToPrune };
}

export async function sendBackupToDrive(pathname) {
  const endpoint = process.env.GOOGLE_BACKUP_WEBAPP_URL;
  if (!endpoint) return { status: 'not_configured' };
  if (!driveConfigured()) {
    return { status: 'invalid_configuration' };
  }
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: process.env.CRON_SECRET, pathname }),
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true) throw new Error(result.error || `HTTP ${response.status}`);
    return { status: 'saved', date: result.date };
  } catch (error) {
    console.error('Google Drive backup failed:', error);
    return { status: 'failed' };
  }
}

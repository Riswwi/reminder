import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { del, get, head, list, put } from '@vercel/blob';
import { makeTaskBackup, parseTaskBackup } from '../../../../lib/taskBackup';
import { AUTOMATIC_BACKUP_PREFIX, planBackupCleanup } from '../../../../lib/automaticBackup';

export const runtime = 'nodejs';
export const maxDuration = 60;

function getBackupFirestore() {
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

async function listAutomaticBackups() {
  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix: AUTOMATIC_BACKUP_PREFIX, limit: 1000, cursor });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
    if (page.hasMore && !cursor) throw new Error('Backup listing did not return a cursor.');
  } while (cursor);
  return blobs;
}

export async function GET(request) {
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'Automatic backups are not configured.' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN || !process.env.FIREBASE_PROJECT_ID ||
      !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    return Response.json({ error: 'Backup storage or Firestore credentials are not configured.' }, { status: 503 });
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const pathname = `${AUTOMATIC_BACKUP_PREFIX}${today}.json`;
    const previous = await listAutomaticBackups();
    if (previous.some(blob => blob.pathname === pathname)) {
      return Response.json({ ok: true, alreadySaved: true, date: today });
    }

    const snapshot = await getBackupFirestore().collection('tasks').get();
    if (snapshot.empty) {
      return Response.json({ error: 'Task collection is empty; older backups were preserved.' }, { status: 409 });
    }
    const content = makeTaskBackup(snapshot.docs.map(item => ({ id: item.id, data: item.data() })));
    const contentBytes = Buffer.byteLength(content, 'utf8');

    // A sudden large drop may be an accidental deletion. Do not rotate good copies away.
    let safeToPrune = true;
    const latest = previous
      .filter(blob => /^todo-interval\/automatic\/\d{4}-\d{2}-\d{2}\.json$/.test(blob.pathname))
      .sort((a, b) => b.pathname.localeCompare(a.pathname))[0];
    if (latest) {
      try {
        const lastFile = await get(latest.url, { access: 'private', useCache: false });
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
      access: 'private',
      addRandomSuffix: false,
      contentType: 'application/json',
    });
    const confirmed = await head(saved.url);
    if (!confirmed || confirmed.size !== contentBytes) {
      throw new Error('Uploaded backup could not be verified; cleanup was skipped.');
    }

    let removed = 0;
    if (safeToPrune) {
      const all = await listAutomaticBackups();
      const cleanup = planBackupCleanup(all);
      for (const old of cleanup.remove) {
        await del(old.url);
        removed += 1;
      }
    }
    return Response.json({ ok: true, date: today, tasks: snapshot.size, bytes: contentBytes, removed, cleanupSkipped: !safeToPrune });
  } catch (error) {
    console.error('Automatic task backup failed:', error);
    return Response.json({ error: 'Automatic backup failed. Existing backups were not intentionally cleared.' }, { status: 500 });
  }
}

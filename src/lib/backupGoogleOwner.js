import { get, head, put } from '@vercel/blob';
import { getAuth } from 'firebase-admin/auth';
import { backupAdminApp } from './serverTaskBackup';

const OWNER_PATH = 'todo-interval/config/backup-google-owner.json';

export async function verifiedGoogleUser(token) {
  if (!token || token.length > 8192) return null;
  try {
    const user = await getAuth(backupAdminApp()).verifyIdToken(token, true);
    if (!user.email_verified || user.firebase?.sign_in_provider !== 'google.com') return null;
    return { uid: user.uid, email: user.email || '' };
  } catch { return null; }
}

export async function getBackupGoogleOwner() {
  const file = await get(OWNER_PATH, { access: 'private', useCache: false });
  if (!file) return null;
  const owner = JSON.parse(await new Response(file.stream).text());
  return typeof owner.uid === 'string' && owner.uid ? owner : null;
}

export async function setBackupGoogleOwner(user) {
  const record = JSON.stringify({ uid: user.uid, email: user.email, linkedAt: new Date().toISOString() });
  const saved = await put(OWNER_PATH, record, {
    access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json',
  });
  if ((await head(saved.url)).size !== Buffer.byteLength(record, 'utf8')) {
    throw new Error('Google owner was not saved.');
  }
}

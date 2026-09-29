import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const SESSION_MS = 365 * 24 * 60 * 60 * 1000;

function signature(secret, expiry, nonce) {
  return createHmac('sha256', secret)
    .update(`todo-interval-backup-web-v1:${expiry}:${nonce}`)
    .digest('hex');
}

export function createBackupWebSession(secret, now = Date.now()) {
  if (!secret) throw new Error('Backup secret is missing.');
  const expiry = now + SESSION_MS;
  const nonce = randomBytes(24).toString('base64url');
  return `v1.${expiry}.${nonce}.${signature(secret, expiry, nonce)}`;
}

export function verifyBackupWebSession(value, secret, now = Date.now()) {
  if (!secret || typeof value !== 'string') return false;
  const match = /^v1\.(\d{13})\.([A-Za-z0-9_-]{32})\.([a-f0-9]{64})$/.exec(value);
  if (!match) return false;
  const expiry = Number(match[1]);
  if (expiry <= now || expiry > now + SESSION_MS) return false;
  const expected = Buffer.from(signature(secret, match[1], match[2]), 'hex');
  const received = Buffer.from(match[3], 'hex');
  return timingSafeEqual(expected, received);
}

export function matchesBackupSecret(provided, secret) {
  if (!secret || typeof provided !== 'string') return false;
  const candidate = provided.startsWith('Bearer ') ? provided.slice(7) : '';
  const expected = Buffer.from(secret);
  const received = Buffer.from(candidate);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

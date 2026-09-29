import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBackupWebSession, matchesBackupSecret, verifyBackupWebSession,
} from '../src/lib/backupWebSession.mjs';

const secret = 'a-private-backup-code-with-enough-entropy';
const now = Date.UTC(2026, 8, 29, 12);

test('saved browser access is signed, expires, and is invalidated by secret rotation', () => {
  const session = createBackupWebSession(secret, now);
  assert.equal(verifyBackupWebSession(session, secret, now), true);
  assert.equal(verifyBackupWebSession(session, secret, now + 365 * 24 * 60 * 60 * 1000), false);
  assert.equal(verifyBackupWebSession(session, `${secret}-changed`, now), false);
  assert.equal(verifyBackupWebSession(`${session.slice(0, -1)}${session.endsWith('0') ? '1' : '0'}`, secret, now), false);
  assert.equal(verifyBackupWebSession('not-a-session', secret, now), false);
  assert.equal(verifyBackupWebSession(session, '', now), false);
});

test('new sessions have independent nonces', () => {
  assert.notEqual(createBackupWebSession(secret, now), createBackupWebSession(secret, now));
});

test('existing bearer code works, but malformed or incorrect values do not', () => {
  assert.equal(matchesBackupSecret(`Bearer ${secret}`, secret), true);
  assert.equal(matchesBackupSecret(`Bearer ${secret}-wrong`, secret), false);
  assert.equal(matchesBackupSecret(secret, secret), false);
  assert.equal(matchesBackupSecret(null, secret), false);
});

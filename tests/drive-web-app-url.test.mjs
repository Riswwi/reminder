import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validDriveWebAppUrl } from '../src/lib/driveWebAppUrl.mjs';

test('only an exact deployed Google Apps Script URL can be saved', () => {
  assert.equal(validDriveWebAppUrl('https://script.google.com/macros/s/AKfycb_123-xyz/exec'), true);
  assert.equal(validDriveWebAppUrl('https://script.google.com/macros/s/AKfycb_123-xyz/dev'), false);
  assert.equal(validDriveWebAppUrl('https://script.google.com.evil.test/macros/s/id/exec'), false);
  assert.equal(validDriveWebAppUrl('http://script.google.com/macros/s/id/exec'), false);
  assert.equal(validDriveWebAppUrl('https://script.google.com/macros/s/id/exec?token=secret'), false);
  assert.equal(validDriveWebAppUrl(['https://script.google.com/macros/s/id/exec']), false);
});

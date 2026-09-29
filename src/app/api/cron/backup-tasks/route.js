import { backupConfigured, createTaskBackup, getDailyEnabled, sendBackupToDrive } from '../../../../lib/serverTaskBackup';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request) {
  if (!backupConfigured()) {
    return Response.json({ error: 'Automatic backups are not configured.' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  try {
    if (!(await getDailyEnabled())) {
      return Response.json({ ok: true, skipped: 'daily_backups_disabled' });
    }
    const backup = await createTaskBackup({ daily: true });
    // Keep the legacy trigger as a fallback until the independent Google trigger is installed.
    // The script reads Firestore itself and deduplicates the daily Drive file.
    const drive = await sendBackupToDrive(backup.pathname);
    return Response.json({ ok: true, backup, drive });
  } catch (error) {
    console.error('Automatic task backup failed:', error);
    return Response.json({ error: 'Automatic backup failed. Existing backups were preserved.' }, { status: 500 });
  }
}

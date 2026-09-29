import { get } from '@vercel/blob';
import { backupName } from '../../../../lib/automaticBackup';
import { listAutomaticBackups } from '../../../../lib/serverTaskBackup';
import { parseTaskBackup } from '../../../../lib/taskBackup';

export const runtime = 'nodejs';

export async function GET(request) {
  if (!process.env.CRON_SECRET || !process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ error: 'Automatic backups are not configured.' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const requested = new URL(request.url).searchParams.get('pathname');
    if (requested && !backupName.test(requested)) {
      return Response.json({ error: 'Invalid backup name.' }, { status: 400 });
    }
    const backups = await listAutomaticBackups();
    const target = requested ? backups.find(blob => blob.pathname === requested) : backups[0];
    if (!target) return Response.json({ error: 'Backup not found.' }, { status: 404 });
    const file = await get(target.url, { access: 'private', useCache: false });
    if (!file?.stream || (file.blob.size || 0) > 20 * 1024 * 1024) {
      throw new Error('Latest backup is unavailable or too large.');
    }
    const content = await new Response(file.stream).text();
    parseTaskBackup(content);
    return new Response(content, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${target.pathname.split('/').pop()}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Unable to read latest task backup:', error);
    return Response.json({ error: 'Latest backup is unavailable.' }, { status: 500 });
  }
}

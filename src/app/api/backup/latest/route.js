import { get, list } from '@vercel/blob';
import { AUTOMATIC_BACKUP_PREFIX } from '../../../../lib/automaticBackup';
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
    let cursor;
    let latest = null;
    do {
      const page = await list({ prefix: AUTOMATIC_BACKUP_PREFIX, limit: 1000, cursor });
      for (const blob of page.blobs) {
        if (/^todo-interval\/automatic\/\d{4}-\d{2}-\d{2}\.json$/.test(blob.pathname) &&
            (!latest || blob.pathname > latest.pathname)) latest = blob;
      }
      cursor = page.hasMore ? page.cursor : undefined;
      if (page.hasMore && !cursor) throw new Error('Backup listing did not return a cursor.');
    } while (cursor);
    if (!latest) return Response.json({ error: 'No automatic backup exists yet.' }, { status: 404 });
    const file = await get(latest.url, { access: 'private', useCache: false });
    if (!file?.stream || (file.blob.size || 0) > 20 * 1024 * 1024) {
      throw new Error('Latest backup is unavailable or too large.');
    }
    const content = await new Response(file.stream).text();
    parseTaskBackup(content);
    return new Response(content, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${latest.pathname.split('/').pop()}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Unable to read latest task backup:', error);
    return Response.json({ error: 'Latest backup is unavailable.' }, { status: 500 });
  }
}

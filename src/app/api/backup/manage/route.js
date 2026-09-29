import {
  backupConfigured, createTaskBackup, driveConfigured, getDailyEnabled, listAutomaticBackups,
  sendBackupToDrive, setDailyEnabled,
} from '../../../../lib/serverTaskBackup';

export const runtime = 'nodejs';
export const maxDuration = 60;

const allowedOrigins = new Set([
  'https://reminder-amber-theta.vercel.app',
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
]);

function respond(request, body, status = 200) {
  const origin = request.headers.get('origin');
  const headers = { 'Cache-Control': 'no-store', Vary: 'Origin' };
  if (allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return Response.json(body, { status, headers });
}

export function OPTIONS(request) {
  const origin = request.headers.get('origin');
  if (!allowedOrigins.has(origin)) return new Response(null, { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
    },
  });
}

function authorize(request) {
  return backupConfigured() && request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request) {
  if (!backupConfigured()) return respond(request, { error: 'Резервное копирование ещё не настроено в Vercel.' }, 503);
  if (!authorize(request)) return respond(request, { error: 'Неверный код резервного копирования.' }, 401);
  try {
    const [dailyEnabled, backups] = await Promise.all([getDailyEnabled(), listAutomaticBackups()]);
    return respond(request, {
      dailyEnabled,
      driveConfigured: driveConfigured(),
      lastVercelBackup: backups[0]?.uploadedAt || null,
      backupCount: backups.length,
    });
  } catch (error) {
    console.error('Backup status failed:', error);
    return respond(request, { error: 'Не удалось получить состояние копий.' }, 500);
  }
}

export async function POST(request) {
  if (!backupConfigured()) return respond(request, { error: 'Резервное копирование ещё не настроено в Vercel.' }, 503);
  if (!authorize(request)) return respond(request, { error: 'Неверный код резервного копирования.' }, 401);
  let input;
  try {
    const text = await request.text();
    if (text.length > 1024) return respond(request, { error: 'Некорректный запрос.' }, 413);
    input = JSON.parse(text);
  } catch { return respond(request, { error: 'Некорректный запрос.' }, 400); }
  try {
    if (input.action === 'setDaily' && typeof input.enabled === 'boolean') {
      await setDailyEnabled(input.enabled);
      return respond(request, { ok: true, dailyEnabled: input.enabled });
    }
    if (input.action === 'run') {
      const backup = await createTaskBackup();
      const drive = await sendBackupToDrive(backup.pathname);
      return respond(request, { ok: true, backup, drive });
    }
    return respond(request, { error: 'Неизвестная команда.' }, 400);
  } catch (error) {
    console.error('Backup control failed:', error);
    return respond(request, { error: 'Не удалось выполнить резервное копирование. Старые копии сохранены.' }, 500);
  }
}

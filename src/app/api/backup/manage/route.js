import {
  backupConfigured, createTaskBackup, driveConfigured, getDailyEnabled, listAutomaticBackups,
  sendBackupToDrive, setDailyEnabled, setDriveWebAppUrl, validDriveWebAppUrl,
} from '../../../../lib/serverTaskBackup';
import {
  createBackupWebSession, matchesBackupSecret, verifyBackupWebSession,
} from '../../../../lib/backupWebSession.mjs';

export const runtime = 'nodejs';
export const maxDuration = 60;

const allowedOrigins = new Set([
  'https://reminder-amber-theta.vercel.app',
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
]);

function respond(request, body, status = 200, setCookie) {
  const origin = request.headers.get('origin');
  const headers = { 'Cache-Control': 'no-store', Vary: 'Origin' };
  if (allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  if (setCookie) headers['Set-Cookie'] = setCookie;
  return Response.json(body, { status, headers });
}

function cookieName(request) {
  return new URL(request.url).protocol === 'https:' ? '__Host-todo_backup_session' : 'todo_backup_session';
}

function sessionCookie(request, value, clear = false) {
  const secure = new URL(request.url).protocol === 'https:';
  return `${cookieName(request)}=${value}; Path=/; HttpOnly; SameSite=Strict; ` +
    (secure ? 'Secure; ' : '') + `Max-Age=${clear ? 0 : 365 * 24 * 60 * 60}`;
}

function readSessionCookie(request) {
  const name = `${cookieName(request)}=`;
  const entry = (request.headers.get('cookie') || '').split(';').map(item => item.trim())
    .find(item => item.startsWith(name));
  return entry?.slice(name.length) || '';
}

function sameOrigin(request) {
  return request.headers.get('origin') === new URL(request.url).origin;
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
  if (!backupConfigured()) return null;
  if (matchesBackupSecret(request.headers.get('authorization'), process.env.CRON_SECRET)) return 'bearer';
  if (verifyBackupWebSession(readSessionCookie(request), process.env.CRON_SECRET)) return 'cookie';
  return null;
}

async function status() {
  const [dailyEnabled, backups, driveReady] = await Promise.all([getDailyEnabled(), listAutomaticBackups(), driveConfigured()]);
  return {
    dailyEnabled,
    driveConfigured: driveReady,
    lastVercelBackup: backups[0]?.uploadedAt || null,
    backupCount: backups.length,
  };
}

export async function GET(request) {
  if (!backupConfigured()) return respond(request, { error: 'Резервное копирование ещё не настроено в Vercel.' }, 503);
  const auth = authorize(request);
  if (!auth) return respond(request, { error: 'Неверный код резервного копирования.' }, 401);
  try {
    return respond(request, await status(), 200,
      auth === 'cookie' ? sessionCookie(request, createBackupWebSession(process.env.CRON_SECRET)) : undefined);
  } catch (error) {
    console.error('Backup status failed:', error);
    return respond(request, { error: 'Не удалось получить состояние копий.' }, 500);
  }
}

export async function POST(request) {
  let input;
  try {
    const text = await request.text();
    if (text.length > 1024) return respond(request, { error: 'Некорректный запрос.' }, 413);
    input = JSON.parse(text);
  } catch { return respond(request, { error: 'Некорректный запрос.' }, 400); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return respond(request, { error: 'Некорректный запрос.' }, 400);
  }
  if (input?.action === 'forget' && sameOrigin(request)) {
    return respond(request, { ok: true }, 200, sessionCookie(request, '', true));
  }
  if (!backupConfigured()) return respond(request, { error: 'Резервное копирование ещё не настроено в Vercel.' }, 503);
  const auth = authorize(request);
  if (input?.action === 'remember') {
    if (!sameOrigin(request) || auth !== 'bearer') {
      return respond(request, { error: 'Неверный код резервного копирования.' }, 401);
    }
    try {
      return respond(request, await status(), 200,
        sessionCookie(request, createBackupWebSession(process.env.CRON_SECRET)));
    } catch (error) {
      console.error('Backup status failed:', error);
      return respond(request, { error: 'Не удалось получить состояние копий.' }, 500);
    }
  }
  if (!auth || (auth === 'cookie' && !sameOrigin(request))) {
    return respond(request, { error: 'Неверный код резервного копирования.' }, 401);
  }
  try {
    if (input.action === 'setDaily' && typeof input.enabled === 'boolean') {
      await setDailyEnabled(input.enabled);
      return respond(request, { ok: true, dailyEnabled: input.enabled });
    }
    if (input.action === 'setDriveUrl') {
      if (!validDriveWebAppUrl(input.url)) {
        return respond(request, { error: 'Нужен адрес Google Apps Script Web app, оканчивающийся на /exec.' }, 400);
      }
      await setDriveWebAppUrl(input.url);
      return respond(request, { ok: true, driveConfigured: true });
    }
    if (input.action === 'runDrive') {
      if (!(await driveConfigured())) {
        return respond(request, { error: 'Ручной запуск Google Drive ещё не настроен. Вставьте адрес Web app скрипта в настройках.' }, 503);
      }
      const timestamp = new Date().toISOString().slice(0, 23).replace(/[:.]/g, '-');
      const drive = await sendBackupToDrive(`todo-interval/automatic/${timestamp}.json`);
      if (drive.status !== 'saved') {
        return respond(request, { error: 'Google Drive не подтвердил создание копии. Проверьте BACKUP_TOKEN и журнал запусков скрипта.' }, 502);
      }
      return respond(request, { ok: true, drive });
    }
    if (input.action === 'runVercel') {
      const backup = await createTaskBackup();
      return respond(request, { ok: true, backup });
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

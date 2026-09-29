export const BACKUP_FORMAT = 'todo-interval-tasks';
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = id => /^(0|[1-9]\d*)$/.test(String(id)) && Number.isSafeInteger(Number(id));

function validateValue(value, depth = 0) {
  if (depth > 30) throw new Error('Слишком глубокая структура задачи.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    value.forEach(item => validateValue(item, depth + 1));
    return;
  }
  if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Недопустимое поле в задаче.');
      validateValue(item, depth + 1);
    }
    return;
  }
  throw new Error('Неподдерживаемое значение в задаче.');
}

export function makeTaskBackup(documents) {
  const tasks = documents.map(({ id, data }) => ({ id: String(id), data: { ...data, id: Number(id) } }));
  const content = JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    project: 'reminder-60e25',
    exportedAt: new Date().toISOString(),
    tasks,
  }, null, 2);
  parseTaskBackup(content);
  return content;
}

export function parseTaskBackup(text) {
  if (new Blob([text]).size > MAX_BACKUP_BYTES) throw new Error('Файл больше 20 МБ.');
  let backup;
  try { backup = JSON.parse(text); } catch { throw new Error('Не удалось прочитать JSON-файл.'); }
  if (!isRecord(backup) || backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION || backup.project !== 'reminder-60e25' || !Array.isArray(backup.tasks)) {
    throw new Error('Это не совместимая резервная копия To-Do Interval.');
  }
  const ids = new Set();
  const tasks = backup.tasks.map((entry, index) => {
    if (!isRecord(entry) || !validId(entry.id) || ids.has(String(entry.id)) || !isRecord(entry.data)) {
      throw new Error(`Некорректная или повторяющаяся задача №${index + 1}.`);
    }
    if (typeof entry.data.title !== 'string' || !entry.data.title.trim()) {
      throw new Error(`У задачи №${index + 1} нет названия.`);
    }
    validateValue(entry.data);
    ids.add(String(entry.id));
    return { id: String(entry.id), data: { ...entry.data, id: Number(entry.id) } };
  });
  return { tasks, exportedAt: backup.exportedAt };
}

export function taskFingerprint(data) {
  const canonical = value => {
    if (Array.isArray(value)) return value.map(canonical);
    if (isRecord(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
    return value;
  };
  return JSON.stringify(canonical(data));
}

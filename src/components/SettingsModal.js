"use client";

import { useRef, useState } from 'react';
import { collection, doc, getDocsFromServer, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { makeTaskBackup, parseTaskBackup, taskFingerprint, MAX_BACKUP_BYTES } from '../lib/taskBackup';
import { pingMobile } from '../lib/pingMobile';

export default function SettingsModal({ isOpen, onClose, contentWidth, setContentWidth, calendarWidth, setCalendarWidth }) {
  const fileRef = useRef(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState('');
  const [backupMessage, setBackupMessage] = useState('');
  const [preview, setPreview] = useState(null);
  const [overwriteIds, setOverwriteIds] = useState([]);
  const [backupSecret, setBackupSecret] = useState('');
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [remoteStatus, setRemoteStatus] = useState(null);
  const [remoteMessage, setRemoteMessage] = useState('');

  const closeSettings = () => {
    setBackupSecret('');
    setRemoteStatus(null);
    setRemoteMessage('');
    onClose();
  };

  const manageRemoteBackup = async (action, enabled) => {
    if (!backupSecret.trim() || remoteBusy) return;
    setRemoteBusy(true); setRemoteMessage('');
    try {
      const response = await fetch('/api/backup/manage', {
        method: action === 'status' ? 'GET' : 'POST',
        headers: {
          Authorization: `Bearer ${backupSecret.trim()}`,
          ...(action === 'status' ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(action === 'status' ? {} : { body: JSON.stringify(action === 'run' ? { action: 'run' } : { action: 'setDaily', enabled }) }),
        cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Сервер не ответил.');
      if (action === 'status') {
        setRemoteStatus(result);
        setRemoteMessage('Подключение проверено.');
      } else if (action === 'setDaily') {
        setRemoteStatus(current => ({ ...current, dailyEnabled: enabled }));
        setRemoteMessage(enabled ? 'Ежедневные копии Vercel включены.' : 'Ежедневные копии Vercel выключены. Google Drive управляется отдельно.');
      } else {
        const drive = result.drive?.status;
        setRemoteMessage(drive === 'saved'
          ? `Копия ${result.backup.tasks ?? ''} задач сохранена в Vercel и Google Drive.`
          : `Копия сохранена в Vercel. Google Drive: ${drive === 'not_configured' ? 'ещё не подключён' : 'сохранить не удалось'}.`);
        setRemoteStatus(current => current && ({ ...current, lastVercelBackup: new Date().toISOString() }));
      }
    } catch (error) { setRemoteMessage(`Ошибка: ${error.message}`); }
    finally { setRemoteBusy(false); }
  };

  const readCloudTasks = async () => {
    const snapshot = await getDocsFromServer(collection(db, 'tasks'));
    return new Map(snapshot.docs.map(item => [item.id, item.data()]));
  };

  const exportTasks = async () => {
    setBackupBusy(true); setBackupError(''); setBackupMessage('');
    try {
      const cloud = await readCloudTasks();
      const contents = makeTaskBackup([...cloud].map(([id, data]) => ({ id, data })));
      const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `todo-interval-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setBackupMessage(`Сохранено задач: ${cloud.size}. Храните файл вне телефона.`);
    } catch (error) { setBackupError(`Экспорт не выполнен: ${error.message}`); }
    finally { setBackupBusy(false); }
  };

  const chooseBackup = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBackupBusy(true); setBackupError(''); setBackupMessage(''); setPreview(null); setOverwriteIds([]);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Файл больше 20 МБ.');
      const backup = parseTaskBackup(await file.text());
      const cloud = await readCloudTasks();
      setPreview({ ...backup, existing: Object.fromEntries([...cloud].map(([id, data]) => [id, taskFingerprint(data)])) });
    } catch (error) { setBackupError(`Файл не загружен: ${error.message}`); }
    finally { setBackupBusy(false); }
  };

  const restoreTasks = async () => {
    if (!preview || backupBusy) return;
    const selected = preview.tasks.filter(task => !Object.hasOwn(preview.existing, task.id) || overwriteIds.includes(task.id));
    if (!selected.length) return;
    setBackupBusy(true); setBackupError(''); setBackupMessage('');
    let written = 0;
    try {
      for (let offset = 0; offset < selected.length; offset += 100) {
        const chunk = selected.slice(offset, offset + 100);
        await runTransaction(db, async transaction => {
          const refs = chunk.map(task => doc(db, 'tasks', task.id));
          const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
          chunk.forEach((task, index) => {
            const before = preview.existing[task.id];
            const now = snapshots[index].exists() ? snapshots[index].data() : undefined;
            if ((before === undefined && now !== undefined) || (before !== undefined && (now === undefined || taskFingerprint(now) !== before))) {
              throw new Error('Задачи изменились после предпросмотра. Выберите файл заново для нового сравнения.');
            }
          });
          chunk.forEach((task, index) => transaction.set(refs[index], task.data));
        });
        written += chunk.length;
      }
      setPreview(null); setOverwriteIds([]);
      setBackupMessage(`Восстановлено задач: ${written}. Остальные задачи не удалены.`);
      void pingMobile(null, 'sync');
    } catch (error) { setBackupError(`Восстановление остановлено. Уже записано: ${written || 0}. ${error.message}`); }
    finally { setBackupBusy(false); }
  };

  if (!isOpen) return null;

  return (
    <div className={`modal-overlay ${isOpen ? '' : 'hidden'}`} onClick={closeSettings}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Настройки</h2>
        <div className="settings-scroll-area">

          <div className="form-group" style={{ marginTop: '16px' }}>
            <label>Уведомления</label>
            <div className="toggle-group" style={{ padding: '12px 16px', background: 'var(--surface-light)', borderRadius: '12px' }}>
              <span style={{ fontSize: '16px' }}>Разрешить уведомления</span>
              <label className="switch">
                <input type="checkbox" defaultChecked />
                <span className="slider round"></span>
              </label>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', padding: '0 8px' }}>В веб-версии уведомления работают только при открытой вкладке или с разрешения браузера.</p>
          </div>

          <div className="form-group" style={{ marginTop: '24px' }}>
            <label>Тестовое уведомление</label>
            <button 
              className="btn btn-secondary w-100" 
              onClick={() => alert('Напоминание сработало бы здесь!')}
              style={{ marginTop: '8px' }}
            >
              Проверить уведомление
            </button>
          </div>
          <div className="form-group backup-section">
            <label>Резервная копия задач</label>
            <p>Ежедневные копии Vercel и Google Drive работают независимо, когда они настроены. Переключатель ниже управляет только Vercel; расписание Drive настраивается в Google Apps Script. Для управления Vercel введите CRON_SECRET; код не сохраняется в браузере.</p>
            <input className="styled-input w-100" type="password" autoComplete="off" placeholder="Код резервного копирования" aria-label="Код резервного копирования" value={backupSecret} onChange={event => { setBackupSecret(event.target.value); setRemoteStatus(null); }} />
            <div className="backup-actions">
              <button className="btn btn-secondary" disabled={!backupSecret.trim() || remoteBusy} onClick={() => manageRemoteBackup('status')}>Проверить подключение</button>
              <button className="btn btn-primary" disabled={!remoteStatus || remoteBusy} onClick={() => manageRemoteBackup('run')}>Создать копию сейчас</button>
            </div>
            {remoteStatus && <>
              <div className="toggle-group" style={{ padding: '12px 16px', background: 'var(--surface-light)', borderRadius: '12px', marginTop: '12px' }}>
                <span>Ежедневные копии Vercel</span>
                <label className="switch"><input type="checkbox" checked={remoteStatus.dailyEnabled} disabled={remoteBusy} onChange={event => manageRemoteBackup('setDaily', event.target.checked)} /><span className="slider round"></span></label>
              </div>
              <p>Vercel: {remoteStatus.lastVercelBackup ? new Date(remoteStatus.lastVercelBackup).toLocaleString('ru-RU') : 'копий пока нет'}. Google Drive: {remoteStatus.driveConfigured ? 'ручной вызов подключён; ежедневный триггер проверьте в Google Apps Script' : 'ручной вызов не подключён; ежедневные копии Drive проверяйте в Google Apps Script'}.</p>
            </>}
            {remoteBusy && <p role="status">Создаём копию…</p>}
            {remoteMessage && <p role="status">{remoteMessage}</p>}
            <p>Отдельно можно скачать JSON-файл со всеми задачами и восстановить их вручную. Храните файл вне телефона.</p>
            <div className="backup-actions">
              <button className="btn btn-secondary" disabled={backupBusy} onClick={exportTasks}>Скачать все задачи</button>
              <button className="btn btn-secondary" disabled={backupBusy} onClick={() => fileRef.current?.click()}>Восстановить из файла</button>
            </div>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={chooseBackup} />
            {backupBusy && <p role="status">Пожалуйста, подождите…</p>}
            {backupError && <p className="backup-error" role="alert">{backupError}</p>}
            {backupMessage && <p role="status">{backupMessage}</p>}
            {preview && <div className="backup-preview">
              <strong>Перед восстановлением</strong>
              <p>В файле {preview.tasks.length} задач. Новых: {preview.tasks.filter(task => !Object.hasOwn(preview.existing, task.id)).length}. Уже существуют: {preview.tasks.filter(task => Object.hasOwn(preview.existing, task.id)).length}.</p>
              <p>Отсутствующие задачи будут добавлены. Существующие не изменятся, если не отметить их ниже. Ничего не удаляется.</p>
              <div className="backup-conflicts">
                {preview.tasks.filter(task => Object.hasOwn(preview.existing, task.id)).map(task => <label key={task.id}>
                  <input type="checkbox" checked={overwriteIds.includes(task.id)} onChange={event => setOverwriteIds(ids => event.target.checked ? [...ids, task.id] : ids.filter(id => id !== task.id))} />
                  Заменить «{task.data.title}»
                </label>)}
              </div>
              <div className="backup-actions">
                <button className="btn btn-primary" disabled={backupBusy || !preview.tasks.some(task => !Object.hasOwn(preview.existing, task.id) || overwriteIds.includes(task.id))} onClick={restoreTasks}>Подтвердить восстановление</button>
                <button className="btn btn-secondary" disabled={backupBusy} onClick={() => { setPreview(null); setOverwriteIds([]); }}>Отмена</button>
              </div>
            </div>}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={closeSettings}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}

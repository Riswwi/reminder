"use client";

import { useEffect, useRef, useState } from 'react';
import { collection, doc, getDocsFromServer, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { makeTaskBackup, parseTaskBackup, taskFingerprint, MAX_BACKUP_BYTES } from '../lib/taskBackup';
import { pingMobile } from '../lib/pingMobile';

function formatBackupTime(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'ещё нет';
  return new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'medium' });
}

export default function SettingsModal({ isOpen, onClose, contentWidth, setContentWidth, calendarWidth, setCalendarWidth }) {
  const fileRef = useRef(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState('');
  const [backupMessage, setBackupMessage] = useState('');
  const [preview, setPreview] = useState(null);
  const [overwriteIds, setOverwriteIds] = useState([]);
  const [backupSecret, setBackupSecret] = useState('');
  const [driveWebAppUrl, setDriveWebAppUrl] = useState('');
  const [remoteBusy, setRemoteBusy] = useState('');
  const [remoteChecking, setRemoteChecking] = useState(false);
  const [remoteStatus, setRemoteStatus] = useState(null);
  const [remoteNotice, setRemoteNotice] = useState(null);
  const sessionCheckRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    sessionCheckRef.current = controller;
    setRemoteChecking(true);
    setRemoteNotice(null);
    fetch('/api/backup/manage', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (response.status === 401) return null;
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Сервер не ответил.');
        return result;
      })
      .then(result => {
        if (!controller.signal.aborted) setRemoteStatus(result);
      })
      .catch(error => {
        if (!controller.signal.aborted) setRemoteNotice({ type: 'error', text: 'Не удалось проверить доступ: ' + error.message });
      })
      .finally(() => {
        if (!controller.signal.aborted) setRemoteChecking(false);
      });
    return () => {
      controller.abort();
      if (sessionCheckRef.current === controller) sessionCheckRef.current = null;
    };
  }, [isOpen]);

  const closeSettings = () => {
    setBackupSecret('');
    setDriveWebAppUrl('');
    setRemoteStatus(null);
    setRemoteNotice(null);
    onClose();
  };

  const manageRemoteBackup = async (action, enabled) => {
    if (remoteBusy || (action === 'status' && !backupSecret.trim()) || (action === 'setDriveUrl' && !driveWebAppUrl.trim())) return;
    sessionCheckRef.current?.abort();
    setRemoteChecking(false);
    const actionName = {
      status: 'Проверяем ключ…', setDaily: 'Сохраняем настройку…',
      setDriveUrl: 'Сохраняем адрес…', runVercel: 'Создаём копию в Vercel…',
      runDrive: 'Создаём копию в Google Drive…',
    }[action] || 'Выполняем…';
    setRemoteBusy(action);
    setRemoteNotice({ type: 'progress', text: actionName });
    try {
      const response = await fetch('/api/backup/manage', {
        method: 'POST',
        headers: {
          ...(action === 'status' ? { Authorization: `Bearer ${backupSecret.trim()}` } : {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(action === 'status' ? { action: 'remember' } : action === 'setDaily' ? { action, enabled } : action === 'setDriveUrl' ? { action, url: driveWebAppUrl.trim() } : { action }),
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401 && action !== 'status') setRemoteStatus(null);
        throw new Error(`${result.error || 'Сервер не ответил.'} (HTTP ${response.status})`);
      }
      if (action === 'status') {
        setRemoteStatus(result);
        setBackupSecret('');
        setRemoteNotice({ type: 'success', text: 'Ключ принят. Доступ сохранён в этом браузере.' });
      } else if (action === 'setDaily') {
        setRemoteStatus(current => ({ ...current, dailyEnabled: enabled }));
        setRemoteNotice({ type: 'success', text: enabled ? 'Ежедневные копии Vercel включены.' : 'Ежедневные копии Vercel выключены.' });
      } else if (action === 'runDrive') {
        if (result.lastDriveBackup) setRemoteStatus(current => current && ({ ...current, lastDriveBackup: result.lastDriveBackup }));
        setRemoteNotice({ type: result.warning ? 'warning' : 'success', text: result.warning || 'Копия в Google Drive создана. Время сохранения обновлено.' });
      } else if (action === 'setDriveUrl') {
        setRemoteStatus(current => ({ ...current, driveConfigured: true }));
        setDriveWebAppUrl('');
        setRemoteNotice({ type: 'success', text: 'Адрес Drive сохранён. Нажмите «Создать копию», чтобы проверить подключение.' });
      } else if (action === 'runVercel') {
        setRemoteNotice({ type: 'success', text: `Копия ${result.backup.tasks ?? ''} задач создана в Vercel.` });
        setRemoteStatus(current => current && ({ ...current, lastVercelBackup: new Date().toISOString() }));
      }
    } catch (error) {
      setRemoteNotice({ type: 'error', text: `Ошибка при «${actionName.replace('…', '')}»: ${error.message}` });
    } finally {
      setRemoteBusy('');
    }
  };

  const forgetRemoteBackupAccess = async () => {
    if (remoteBusy) return;
    sessionCheckRef.current?.abort();
    setRemoteBusy('forget');
    setRemoteNotice({ type: 'progress', text: 'Удаляем доступ из браузера…' });
    try {
      const response = await fetch('/api/backup/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'forget' }),
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`Не удалось удалить доступ (HTTP ${response.status}).`);
      setRemoteStatus(null);
      setBackupSecret('');
      setRemoteNotice({ type: 'success', text: 'Доступ удалён из браузера. Копии задач не затронуты.' });
    } catch (error) {
      setRemoteNotice({ type: 'error', text: `Ошибка: ${error.message}` });
    } finally {
      setRemoteBusy('');
    }
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
    <div className={`modal-overlay settings-overlay ${isOpen ? '' : 'hidden'}`} onClick={closeSettings}>
      <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Настройки</h2>
        {remoteNotice && <div className={`backup-activity is-${remoteNotice.type}`} role={remoteNotice.type === 'error' ? 'alert' : 'status'}>
          {remoteNotice.text}
        </div>}
        <div className="settings-scroll-area">
          <div className="form-group backup-section">
            <h3>Резервные копии</h3>
            <div className="backup-access-row">
              <span className={`backup-pill ${remoteStatus ? 'is-ready' : ''}`}>
                {remoteChecking ? 'Проверяем доступ…' : remoteStatus ? '✓ Доступ сохранён в браузере' : 'Доступ не подключён'}
              </span>
              {remoteStatus && <button className="backup-text-button" disabled={!!remoteBusy} onClick={forgetRemoteBackupAccess}>Забыть доступ</button>}
            </div>
            {!remoteStatus && !remoteChecking && <div className="backup-connect-row">
              <input className="styled-input" type="password" autoComplete="off" placeholder="Ключ копирования" aria-label="Ключ копирования" value={backupSecret} onChange={event => setBackupSecret(event.target.value)} />
              <button className="btn btn-primary" disabled={!backupSecret.trim() || !!remoteBusy} onClick={() => manageRemoteBackup('status')}>Подключить</button>
            </div>}
            {remoteStatus && <div className="backup-provider-grid">
              <section className="backup-provider-card" aria-label="Vercel">
                <div className="backup-provider-heading"><strong>Vercel</strong><span className="backup-pill is-ready">Подключён</span></div>
                <div className="backup-date">Последняя копия <strong>{formatBackupTime(remoteStatus.lastVercelBackup)}</strong></div>
                <button className="btn btn-primary" disabled={!!remoteBusy} onClick={() => manageRemoteBackup('runVercel')}>
                  {remoteBusy === 'runVercel' ? 'Сохраняем…' : 'Создать копию'}
                </button>
                <div className="backup-daily-row">
                  <span>Ежедневно</span>
                  <label className="switch" aria-label="Ежедневные копии Vercel"><input type="checkbox" checked={!!remoteStatus.dailyEnabled} disabled={!!remoteBusy} onChange={event => manageRemoteBackup('setDaily', event.target.checked)} /><span className="slider round"></span></label>
                </div>
              </section>
              <section className="backup-provider-card" aria-label="Google Drive">
                <div className="backup-provider-heading"><strong>Google Drive</strong><span className={`backup-pill ${remoteStatus.driveConfigured ? 'is-ready' : ''}`}>{remoteStatus.driveConfigured ? 'Адрес сохранён' : 'Не подключён'}</span></div>
                <div className="backup-date">Последняя копия через сайт <strong>{formatBackupTime(remoteStatus.lastDriveBackup)}</strong></div>
                <button className="btn btn-secondary" disabled={!!remoteBusy || !remoteStatus.driveConfigured} onClick={() => manageRemoteBackup('runDrive')}>
                  {remoteBusy === 'runDrive' ? 'Сохраняем…' : 'Создать копию'}
                </button>
                <details className="backup-config">
                  <summary>{remoteStatus.driveConfigured ? 'Изменить адрес скрипта' : 'Подключить скрипт'}</summary>
                  <div className="backup-connect-row">
                    <input className="styled-input" type="url" inputMode="url" placeholder="Адрес Google-скрипта /exec" aria-label="Адрес Google Apps Script Web app" value={driveWebAppUrl} onChange={event => setDriveWebAppUrl(event.target.value)} />
                    <button className="btn btn-secondary" disabled={!!remoteBusy || !driveWebAppUrl.trim()} onClick={() => manageRemoteBackup('setDriveUrl')}>Сохранить</button>
                  </div>
                </details>
              </section>
            </div>}
            <p className="backup-note">Google Drive делает ежедневные копии отдельно. Сайт показывает время только копий, запущенных кнопкой здесь или в приложении.</p>
            <details className="backup-manual">
              <summary>Скачать или восстановить JSON-файл</summary>
              <div className="backup-actions">
                <button className="btn btn-secondary" disabled={backupBusy} onClick={exportTasks}>Скачать все задачи</button>
                <button className="btn btn-secondary" disabled={backupBusy} onClick={() => fileRef.current?.click()}>Восстановить из файла</button>
              </div>
              <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={chooseBackup} />
              {backupBusy && <p role="status">Работаем с файлом…</p>}
              {backupError && <p className="backup-error" role="alert">{backupError}</p>}
              {backupMessage && <p role="status">{backupMessage}</p>}
            </details>
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

        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={closeSettings}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}

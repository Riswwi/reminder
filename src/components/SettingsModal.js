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
    <div className={`modal-overlay ${isOpen ? '' : 'hidden'}`} onClick={onClose}>
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
            <p>Файл JSON содержит все задачи из облака. Сохраните его также на ПК или другом облачном диске.</p>
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
          <button className="btn btn-secondary" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}

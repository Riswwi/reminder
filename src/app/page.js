"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';

// ─── helpers ──────────────────────────────────────────────────────────────────
const PRIORITY_COLORS = {
  1: { bg: 'rgba(10,132,255,0.12)', border: 'rgba(10,132,255,0.25)', dot: '#0A84FF' },
  2: { bg: 'rgba(255,214,10,0.12)',  border: 'rgba(255,214,10,0.25)',  dot: '#FFD60A' },
  3: { bg: 'rgba(255,69,58,0.12)',   border: 'rgba(255,69,58,0.25)',   dot: '#FF453A' },
};

const MONTH_NAMES = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                     'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

const fmtDate = (ds) => {
  if (!ds) return '';
  const [y, m, d] = ds.split('-');
  const date = new Date(+y, +m - 1, +d);
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
  if (date.getTime() === today.getTime()) return 'Сегодня';
  if (date.getTime() === tomorrow.getTime()) return 'Завтра';
  return date.toLocaleDateString('ru-RU', { weekday:'short', day:'numeric', month:'short' });
};

const toDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

// ─── DeleteDialog ─────────────────────────────────────────────────────────────
function DeleteDialog({ isOpen, onConfirm, onCancel }) {
  if (!isOpen) return null;
  return (
    <div className="delete-dialog-overlay" onClick={onCancel}>
      <div className="delete-dialog-backdrop" />
      <div className="delete-dialog-content" onClick={e => e.stopPropagation()}>
        <div className="delete-dialog-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </div>
        <h3>Удалить событие?</h3>
        <p>Это действие нельзя отменить</p>
        <div className="delete-dialog-actions">
          <button className="delete-dialog-btn cancel" onClick={onCancel}>Отмена</button>
          <button className="delete-dialog-btn confirm" onClick={onConfirm}>Удалить</button>
        </div>
      </div>
    </div>
  );
}

// ─── TaskItem ─────────────────────────────────────────────────────────────────
function TaskItem({ task, onToggle, onDelete, onEdit }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const p = PRIORITY_COLORS[task.priority || 1];

  return (
    <>
      <div
        className={`task-item ${task.done ? 'done' : ''}`}
        style={{ backgroundColor: p.bg, border: `1px solid ${p.border}` }}
      >
        <div
          className="checkbox"
          onClick={e => { e.stopPropagation(); onToggle(task.id, task.done); }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="task-content" style={{ cursor: 'pointer' }} onClick={() => onEdit(task)}>
          <div className="task-title">{task.title}</div>
          {task.desc && <div className="task-desc">{task.desc}</div>}
          <div className="task-badges">
            <span className="badge time-badge">
              {task.isAllDay ? 'Весь день' : (task.dueTime || '09:00')}
            </span>
            {task.priority === 3 && <span className="badge" style={{ color:'#FF453A', background:'rgba(255,69,58,0.12)' }}>Срочно</span>}
            {task.priority === 2 && <span className="badge" style={{ color:'#FFD60A', background:'rgba(255,214,10,0.12)' }}>Скоро</span>}
            {task.repeatType && task.repeatType !== 'none' && (
              <span className="badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:12,height:12}}>
                  <polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M22 14l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                </svg>
              </span>
            )}
          </div>
        </div>
        <button className="delete-btn" onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
      <DeleteDialog
        isOpen={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); onDelete(task.id); }}
      />
    </>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortMethod, setSortMethod] = useState('time');
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      const data = [];
      snapshot.forEach(d => data.push({ ...d.data(), id: String(d.id) }));
      setTasks(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const toggleTask = async (id, current) => {
    try { await updateDoc(doc(db, 'tasks', id), { done: !current }); }
    catch (e) { console.error(e); }
  };

  const deleteTask = async (id) => {
    try { await deleteDoc(doc(db, 'tasks', id)); }
    catch (e) { console.error(e); }
  };

  const openEdit = (task) => {
    window.dispatchEvent(new CustomEvent('openTaskModal', { detail: task }));
  };

  // Sort & group active tasks by date
  const activeTasks = tasks.filter(t => !t.done);
  const completedTasks = tasks.filter(t => t.done);

  const sortedActive = [...activeTasks].sort((a, b) => {
    if (sortMethod === 'priority') {
      const pd = (b.priority || 1) - (a.priority || 1);
      if (pd !== 0) return pd;
    }
    const da = a.dueDate || '1970-01-01';
    const db2 = b.dueDate || '1970-01-01';
    if (da !== db2) return da.localeCompare(db2);
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    return (a.dueTime || '').localeCompare(b.dueTime || '');
  });

  // Group by date only in time-sort mode
  const groups = [];
  if (sortMethod === 'time') {
    const map = new Map();
    sortedActive.forEach(t => {
      const key = t.dueDate || '1970-01-01';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    });
    map.forEach((tasks, date) => groups.push({ date, tasks }));
  } else {
    groups.push({ date: null, tasks: sortedActive });
  }

  return (
    <div className="view-container active" style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column' }}>
      {/* Sort Controls */}
      <div className="sort-controls">
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Сортировка:</span>
        <div className="sort-toggle">
          <button className={`sort-btn ${sortMethod === 'time' ? 'active' : ''}`} onClick={() => setSortMethod('time')}>По времени</button>
          <button className={`sort-btn ${sortMethod === 'priority' ? 'active' : ''}`} onClick={() => setSortMethod('priority')}>По приоритету</button>
        </div>
      </div>

      <div className="task-list-container">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="loading-spinner" />
            Загрузка...
          </div>
        ) : activeTasks.length === 0 && completedTasks.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 48, height: 48, margin: '0 auto 16px', display: 'block', opacity: 0.4 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Нет задач</div>
            <div style={{ fontSize: 14 }}>Нажмите + чтобы добавить первую задачу</div>
          </div>
        ) : (
          <>
            {/* Active tasks grouped */}
            {groups.map(group => (
              <div key={group.date || 'all'}>
                {group.date && (
                  <div className="date-header">{fmtDate(group.date)}</div>
                )}
                {group.tasks.map(task => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={toggleTask}
                    onDelete={deleteTask}
                    onEdit={openEdit}
                  />
                ))}
              </div>
            ))}

            {/* Completed section */}
            {completedTasks.length > 0 && (
              <div className="completed-section">
                <div className="completed-header" onClick={() => setShowCompleted(v => !v)}>
                  <svg
                    className={`completed-header-chevron ${showCompleted ? 'open' : ''}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span className="completed-header-text">Завершённые</span>
                  <span className="completed-header-count">{completedTasks.length}</span>
                </div>
                {showCompleted && (
                  <div className="completed-tasks-list">
                    {completedTasks.map(task => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onToggle={toggleTask}
                        onDelete={deleteTask}
                        onEdit={openEdit}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

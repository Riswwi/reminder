"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';

// ─── helpers ──────────────────────────────────────────────────────────────────
const P_COLORS = {
  1: { accent: '#5E5CE6', dim: 'rgba(94,92,230,0.1)',  border: 'rgba(94,92,230,0.2)' },
  2: { accent: '#FF9F0A', dim: 'rgba(255,159,10,0.1)', border: 'rgba(255,159,10,0.2)' },
  3: { accent: '#FF453A', dim: 'rgba(255,69,58,0.1)',  border: 'rgba(255,69,58,0.2)'  },
};

const fmtDate = (ds) => {
  if (!ds) return 'Без даты';
  const [y, m, d] = ds.split('-');
  const date = new Date(+y, +m - 1, +d);
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((date - today) / 86400000);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Завтра';
  if (diff === -1) return 'Вчера';
  if (diff < 0) return `${Math.abs(diff)} дн. назад`;
  if (diff < 7) return date.toLocaleDateString('ru-RU', { weekday: 'long' });
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
};

const fmtDateShort = (ds) => {
  if (!ds) return '';
  const [y, m, d] = ds.split('-');
  const date = new Date(+y, +m - 1, +d);
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((date - today) / 86400000);
  if (diff === 0) return 'Сег.';
  if (diff === 1) return 'Завт.';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

// ─── Delete Dialog ────────────────────────────────────────────────────────────
function DeleteDialog({ isOpen, onConfirm, onCancel }) {
  if (!isOpen) return null;
  return (
    <div className="delete-dialog-overlay" onClick={onCancel}>
      <div className="delete-dialog-backdrop" />
      <div className="delete-dialog-content" onClick={e => e.stopPropagation()}>
        <div className="delete-dialog-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </div>
        <h3>Удалить задачу?</h3>
        <p>Это действие нельзя отменить</p>
        <div className="delete-dialog-actions">
          <button className="delete-dialog-btn cancel" onClick={onCancel}>Отмена</button>
          <button className="delete-dialog-btn confirm" onClick={onConfirm}>Удалить</button>
        </div>
      </div>
    </div>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────
function TaskRow({ task, onToggle, onDelete, onEdit }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const p = P_COLORS[task.priority || 1];

  return (
    <>
      <div className={`task-row ${task.done ? 'done' : ''}`} onClick={() => onEdit(task)}>
        {/* Priority stripe */}
        <div className="task-row-stripe" style={{ background: p.accent }} />

        {/* Checkbox */}
        <div
          className={`task-row-check ${task.done ? 'checked' : ''}`}
          style={task.done ? { background: p.accent, borderColor: p.accent } : { borderColor: p.border }}
          onClick={e => { e.stopPropagation(); onToggle(task.id, task.done); }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        {/* Content */}
        <div className="task-row-content">
          <div className="task-row-title">{task.title}</div>
          {task.desc && <div className="task-row-desc">{task.desc}</div>}
        </div>

        {/* Meta */}
        <div className="task-row-meta">
          {!task.isAllDay && (
            <span className="task-row-time">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              {task.dueTime || '09:00'}
            </span>
          )}
          {task.priority === 3 && <span className="task-row-badge urgent">Срочно</span>}
          {task.priority === 2 && <span className="task-row-badge soon">Скоро</span>}
        </div>

        {/* Delete */}
        <button
          className="task-row-del"
          onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
        >
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

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortMethod, setSortMethod] = useState('time');
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tasks'), (snap) => {
      const data = [];
      snap.forEach(d => data.push({ ...d.data(), id: String(d.id) }));
      setTasks(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const toggleTask = async (id, cur) => {
    try { await updateDoc(doc(db, 'tasks', id), { done: !cur }); } catch(e) { console.error(e); }
  };
  const deleteTask = async (id) => {
    try { await deleteDoc(doc(db, 'tasks', id)); } catch(e) { console.error(e); }
  };
  const openEdit = (task) => window.dispatchEvent(new CustomEvent('openTaskModal', { detail: task }));

  const active = tasks.filter(t => !t.done);
  const done   = tasks.filter(t => t.done);

  const sorted = [...active].sort((a, b) => {
    if (sortMethod === 'priority') {
      const pd = (b.priority || 1) - (a.priority || 1);
      if (pd !== 0) return pd;
    }
    const da = a.dueDate || '1970-01-01';
    const db2 = b.dueDate || '1970-01-01';
    if (da !== db2) return da.localeCompare(db2);
    return (a.dueTime || '').localeCompare(b.dueTime || '');
  });

  // Group by date (only in time sort)
  const groups = [];
  if (sortMethod === 'time') {
    const map = new Map();
    sorted.forEach(t => {
      const key = t.dueDate || 'none';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    });
    map.forEach((tasks, date) => groups.push({ date, tasks }));
  } else {
    groups.push({ date: null, tasks: sorted });
  }

  if (loading) {
    return (
      <div className="tasks-page">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12, color: 'var(--text-muted)' }}>
          <div className="loading-spinner" />
          Загрузка...
        </div>
      </div>
    );
  }

  if (active.length === 0 && done.length === 0) {
    return (
      <div className="tasks-page">
        <div className="tasks-toolbar">
          <span className="tasks-count">0 задач</span>
        </div>
        <div className="tasks-empty">
          <div className="tasks-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="3"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
              <line x1="8" y1="14" x2="16" y2="14"/>
            </svg>
          </div>
          <div className="tasks-empty-title">Всё чисто!</div>
          <div className="tasks-empty-sub">Нажмите + чтобы добавить первую задачу</div>
        </div>
      </div>
    );
  }

  return (
    <div className="tasks-page">
      {/* Toolbar */}
      <div className="tasks-toolbar">
        <span className="tasks-count">{active.length} {active.length === 1 ? 'задача' : active.length < 5 ? 'задачи' : 'задач'}</span>
        <div className="sort-toggle">
          <button className={`sort-btn ${sortMethod === 'time' ? 'active' : ''}`} onClick={() => setSortMethod('time')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width:12, height:12 }}>
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            По дате
          </button>
          <button className={`sort-btn ${sortMethod === 'priority' ? 'active' : ''}`} onClick={() => setSortMethod('priority')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width:12, height:12 }}>
              <line x1="12" y1="2" x2="12" y2="22"/><polyline points="18 8 12 2 6 8"/><polyline points="6 16 12 22 18 16"/>
            </svg>
            По приоритету
          </button>
        </div>
      </div>

      {/* Task groups */}
      <div className="tasks-body">
        {groups.map(g => (
          <div key={g.date || 'all'} className="task-group">
            {g.date && (
              <div className="task-group-label">
                <span className="task-group-name">{fmtDate(g.date)}</span>
                <span className="task-group-line" />
                <span className="task-group-cnt">{g.tasks.length}</span>
              </div>
            )}
            <div className="task-group-list">
              {g.tasks.map(task => (
                <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} onEdit={openEdit} />
              ))}
            </div>
          </div>
        ))}

        {/* Completed */}
        {done.length > 0 && (
          <div className="task-group">
            <div
              className="task-group-label completed-toggle"
              onClick={() => setShowCompleted(v => !v)}
              style={{ cursor: 'pointer' }}
            >
              <svg
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                style={{ width:12, height:12, color:'var(--text-muted)', transform: showCompleted ? 'rotate(90deg)' : 'none', transition:'transform 0.2s', flexShrink:0 }}
              >
                <polyline points="9 18 15 12 9 6"/>
              </svg>
              <span className="task-group-name">Завершённые</span>
              <span className="task-group-line" />
              <span className="task-group-cnt">{done.length}</span>
            </div>
            {showCompleted && (
              <div className="task-group-list">
                {done.map(task => (
                  <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} onEdit={openEdit} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

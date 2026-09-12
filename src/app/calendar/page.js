"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';

const MONTH_NAMES = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                     'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

const PRIORITY_COLORS = {
  1: { bg: 'rgba(94,92,230,0.12)', border: 'rgba(94,92,230,0.25)' },
  2: { bg: 'rgba(255,214,10,0.12)',  border: 'rgba(255,214,10,0.25)'  },
  3: { bg: 'rgba(255,69,58,0.12)',   border: 'rgba(255,69,58,0.25)'   },
};

const toDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

export default function CalendarPage() {
  const [navDate, setNavDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      const data = [];
      snapshot.forEach(d => data.push({ ...d.data(), id: String(d.id) }));
      
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const updates = [];
      data.forEach(t => {
        if (!t.done && t.dueDate && t.dueDate < todayStr) {
          t.dueDate = todayStr;
          updates.push(updateDoc(doc(db, 'tasks', t.id), { dueDate: todayStr }));
        }
      });
      if (updates.length > 0) {
        Promise.all(updates).catch(e => console.error('Rollover error:', e));
      }

      setTasks(data);
    });
    return () => unsub();
  }, []);

  const changeMonth = (offset) => {
    setNavDate(d => new Date(d.getFullYear(), d.getMonth() + offset, 1));
  };

  const year = navDate.getFullYear();
  const month = navDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let firstDayIdx = new Date(year, month, 1).getDay() - 1;
  if (firstDayIdx === -1) firstDayIdx = 6;

  const today = new Date(); today.setHours(0,0,0,0);
  const selStr = toDateStr(selectedDate);

  // Build calendar days
  const cells = [];
  for (let i = 0; i < firstDayIdx; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const ds = toDateStr(dateObj);
    const dayTasks = tasks.filter(t => t.dueDate === ds);
    const active = dayTasks.filter(t => !t.done);
    const isToday = dateObj.getTime() === today.getTime();
    const isSelected = ds === selStr;
    cells.push({ d, ds, isToday, isSelected, active, done: dayTasks.filter(t => t.done) });
  }

  // Selected date tasks
  const selectedTasks = tasks.filter(t => t.dueDate === selStr && !t.done);
  const selectedDone = tasks.filter(t => t.dueDate === selStr && t.done);

  const openEdit = (task) => {
    window.dispatchEvent(new CustomEvent('openTaskModal', { detail: task }));
  };
  const toggleTask = async (id, current) => {
    try { await updateDoc(doc(db, 'tasks', id), { done: !current }); }
    catch (e) { console.error(e); }
  };
  const deleteTask = async (id) => {
    try { await deleteDoc(doc(db, 'tasks', id)); setConfirmDeleteId(null); }
    catch (e) { console.error(e); }
  };

  const selLabel = selectedDate.toLocaleDateString('ru-RU', { weekday:'long', day:'numeric', month:'long' });

  return (
    <div className="cal-page-layout">
      {/* ── Calendar panel ── */}
      <div className="cal-panel">
        <div className="cal-header">
          <button className="icon-btn" onClick={() => changeMonth(-1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h2>{MONTH_NAMES[month]} {year}</h2>
          <button className="icon-btn" onClick={() => changeMonth(1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        {/* Weekday labels */}
        <div className="cal-weekdays">
          {WEEKDAYS.map(w => <div key={w} className="cal-weekday">{w}</div>)}
        </div>

        {/* Day cells */}
        <div className="cal-days-grid">
          {cells.map((cell, i) =>
            cell === null
              ? <div key={`e${i}`} />
              : (
                <div
                  key={cell.ds}
                  className={`cal-day${cell.isToday ? ' today' : ''}${cell.isSelected ? ' selected' : ''}`}
                  onClick={() => setSelectedDate(new Date(year, month, cell.d))}
                >
                  <span className="cal-day-num">{cell.d}</span>
                  {cell.active.length > 0 && (
                    <div className="cal-dots">
                      {cell.active.slice(0,3).map((_, di) => (
                        <div key={di} className="cal-dot" />
                      ))}
                    </div>
                  )}
                  {cell.active.length > 0 && (
                    <div className="cal-day-count">{cell.active.length}</div>
                  )}
                </div>
              )
          )}
        </div>

        {/* Go to today */}
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button
            className="btn-text primary-text"
            style={{ fontSize: 13 }}
            onClick={() => { setNavDate(new Date()); setSelectedDate(new Date()); }}
          >
            Сегодня
          </button>
        </div>
      </div>

      {/* ── Day tasks panel ── */}
      <div className="cal-tasks-panel">
        <div className="cal-tasks-header">
          <div className="cal-tasks-date">{selLabel}</div>
          <button
            className="cal-add-btn"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('openTaskModal', {
                detail: { dueDate: selStr }
              }));
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Добавить
          </button>
        </div>

        <div className="cal-tasks-scroll">
          {selectedTasks.length === 0 && selectedDone.length === 0 ? (
            <div className="cal-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span>Нет задач на этот день</span>
            </div>
          ) : (
            <>
              {selectedTasks.map(task => {
                const p = PRIORITY_COLORS[task.priority || 1];
                return (
                  <div
                    key={task.id}
                    className="cal-task-item"
                    style={{ backgroundColor: p.bg, borderColor: p.border }}
                    onClick={() => openEdit(task)}
                  >
                    <div
                      className="cal-task-check"
                      style={{ background: p.accent, borderColor: p.accent, width: '16px', height: '16px', borderRadius: '50%', margin: '0 4px', flexShrink: 0 }}
                    ></div>
                    <div className="cal-task-body">
                      <div className="cal-task-title">{task.title}</div>
                      {task.desc && <div className="cal-task-desc">{task.desc}</div>}
                      <div className="cal-task-time">
                        {task.isAllDay
                          ? <span>📅 Весь день</span>
                          : <span>🕐 {task.dueTime || '09:00'}</span>
                        }
                        {task.priority === 3 && <span style={{ color:'#FF453A', marginLeft: 8 }}>● Срочно</span>}
                        {task.priority === 2 && <span style={{ color:'#FFD60A', marginLeft: 8 }}>● Скоро</span>}
                        {task.fileData && (
                          <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, verticalAlign: 'middle' }}>
                              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                            </svg>
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      className="delete-btn"
                      onClick={e => { e.stopPropagation(); setConfirmDeleteId(task.id); }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                );
              })}
              {selectedDone.length > 0 && (
                <div className="cal-done-section">
                  <div className="cal-done-label">Выполнено ({selectedDone.length})</div>
                  {selectedDone.map(task => (
                    <div
                      key={task.id}
                      className="cal-task-item done"
                      style={{ opacity: 0.55, borderColor: 'transparent' }}
                      onClick={() => openEdit(task)}
                    >
                      <div
                        className="cal-task-check checked"
                        onClick={e => { e.stopPropagation(); toggleTask(task.id, task.done); }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                      <div className="cal-task-body">
                        <div className="cal-task-title" style={{ textDecoration:'line-through' }}>{task.title}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div className="delete-dialog-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="delete-dialog-backdrop"/>
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
              <button className="delete-dialog-btn cancel" onClick={() => setConfirmDeleteId(null)}>Отмена</button>
              <button className="delete-dialog-btn confirm" onClick={() => deleteTask(confirmDeleteId)}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

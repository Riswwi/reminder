"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { doc, setDoc, updateDoc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTH_NAMES = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                     'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const WEEKDAYS_SHORT = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
const todayStr = () => toDateStr(new Date());

// ─── Mini Calendar ────────────────────────────────────────────────────────────
function MiniCalendar({ value, onChange, tasks = [] }) {
  const init = value ? new Date(value + 'T00:00:00') : new Date();
  const [nav, setNav] = useState(() => { const d = new Date(init); d.setDate(1); return d; });

  const year = nav.getFullYear();
  const month = nav.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let firstIdx = new Date(year, month, 1).getDay() - 1;
  if (firstIdx === -1) firstIdx = 6;

  const td = todayStr();
  const cells = [];
  for (let i = 0; i < firstIdx; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells.push({ d, ds });
  }

  return (
    <div className="mc-wrap">
      <div className="mc-header">
        <button type="button" className="mc-nav" onClick={() => setNav(n => new Date(n.getFullYear(), n.getMonth()-1, 1))}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="mc-month">{MONTH_NAMES[month]} {year}</span>
        <button type="button" className="mc-nav" onClick={() => setNav(n => new Date(n.getFullYear(), n.getMonth()+1, 1))}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      <div className="mc-grid">
        {WEEKDAYS_SHORT.map(w => <div key={w} className="mc-wday">{w}</div>)}
        {cells.map((cell, i) => {
          if (cell === null) return <div key={`e${i}`} />;
          const hasTasks = tasks.some(t => t.dueDate === cell.ds && !t.done);
          return (
            <button
              key={cell.ds}
              type="button"
              className={`mc-day${cell.ds === td ? ' today' : ''}${cell.ds === value ? ' selected' : ''}`}
              onClick={() => onChange(cell.ds)}
            >
              {cell.d}
              {hasTasks && <div className="mc-dot" />}
            </button>
          );
        })}
      </div>
      <div className="mc-footer">
        <button type="button" className="btn-text primary-text" style={{ fontSize: 12 }}
          onClick={() => { onChange(td); setNav(new Date()); }}>
          Сегодня
        </button>
      </div>
    </div>
  );
}

// ─── Time Picker ──────────────────────────────────────────────────────────────
function TimePicker({ value, onChange }) {
  const [h, m] = (value || '09:00').split(':').map(Number);

  const set = (newH, newM) => {
    onChange(`${String(newH).padStart(2,'0')}:${String(newM).padStart(2,'0')}`);
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const mins  = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <div className="tp-wrap">
      <div className="tp-col">
        <div className="tp-label">ЧАС</div>
        <div className="tp-scroll">
          {hours.map(hh => (
            <button
              key={hh}
              type="button"
              className={`tp-item${hh === h ? ' active' : ''}`}
              onClick={() => set(hh, m)}
            >
              {String(hh).padStart(2,'0')}
            </button>
          ))}
        </div>
      </div>
      <div className="tp-sep">:</div>
      <div className="tp-col">
        <div className="tp-label">МИН</div>
        <div className="tp-scroll">
          {mins.map(mm => (
            <button
              key={mm}
              type="button"
              className={`tp-item${mm === Math.round(m / 5) * 5 ? ' active' : ''}`}
              onClick={() => set(h, mm)}
            >
              {String(mm).padStart(2,'0')}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── BottomSheet ──────────────────────────────────────────────────────────────
function BottomSheet({ isOpen, onClose, title, children }) {
  return (
    <div className={`bottom-sheet-overlay ${isOpen ? '' : 'hidden'}`} onClick={onClose}>
      <div className="bottom-sheet-content" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <h3>{title}</h3>
          <button className="btn-text primary-text" onClick={onClose}>Готово</button>
        </div>
        <div className="sheet-body scrollable-body">{children}</div>
      </div>
    </div>
  );
}

function RadioList({ name, value, onChange, options }) {
  return (
    <div className="radio-list">
      {options.map(opt => (
        <label key={opt.value} className="radio-item">
          <input type="radio" name={name} value={opt.value}
            checked={value === opt.value} onChange={e => onChange(e.target.value)} />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

const getReminderText = (r) => ({
  '-1': 'Без напоминания', '0': 'Вовремя', '15': 'За 15 мин',
  '30': 'За 30 мин', '60': 'За 1 час', '120': 'За 2 часа', '1440': 'За 1 день'
}[r] ?? 'Напоминание');

const getCyclicText = (c) => ({
  'none': 'Без цикла', '60': 'Каждый час', '120': 'Каждые 2 ч', '240': 'Каждые 4 ч'
}[c] ?? 'Цикл');

const getRepeatText = (r) => ({
  'none': 'Не повторяется', 'daily': 'Каждый день',
  'weekly': 'Каждую неделю', 'monthly': 'Каждый месяц', 'yearly': 'Каждый год'
}[r] ?? '');

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function TaskModal({ isOpen, onClose, editTask = null }) {
  const [title, setTitle]       = useState('');
  const [desc, setDesc]         = useState('');
  const [priority, setPriority] = useState(1);
  const [isAllDay, setIsAllDay] = useState(true);
  const [dueDate, setDueDate]   = useState(todayStr());
  const [dueTime, setDueTime]   = useState('09:00');
  const [reminder, setReminder] = useState('-1');
  const [cyclic, setCyclic]     = useState('none');
  const [repeat, setRepeat]     = useState('none');
  const [isSaving, setIsSaving] = useState(false);
  const [tasks, setTasks]       = useState([]);

  const [showRemSheet,    setShowRemSheet]    = useState(false);
  const [showCyclicSheet, setShowCyclicSheet] = useState(false);
  const [showRepeatSheet, setShowRepeatSheet] = useState(false);

  const titleRef = useRef(null);

  // ESC to close
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = onSnapshot(collection(db, 'tasks'), snapshot => {
      const arr = [];
      snapshot.forEach(d => arr.push(d.data()));
      setTasks(arr);
    });
    return () => unsub();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const td = todayStr();
    if (editTask && editTask.title) {
      setTitle(editTask.title || '');
      setDesc(editTask.desc || '');
      setPriority(editTask.priority || 1);
      setIsAllDay(editTask.isAllDay !== false);
      setDueDate(editTask.dueDate || td);
      setDueTime(editTask.dueTime || '09:00');
      setReminder(String(editTask.reminderOffset ?? '-1'));
      setCyclic(editTask.cyclicType || 'none');
      setRepeat(editTask.repeatType || 'none');
    } else {
      setTitle('');
      setDesc('');
      setPriority(1);
      setIsAllDay(true);
      setDueDate(editTask?.dueDate || td);
      const now = new Date();
      setDueTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
      setReminder('-1');
      setCyclic('none');
      setRepeat('none');
    }
    setIsSaving(false);
    setTimeout(() => { titleRef.current?.focus(); titleRef.current?.select(); }, 60);
  }, [isOpen, editTask?.id]);

  const handleSave = async () => {
    if (!title.trim() || isSaving) return;
    setIsSaving(true);
    try {
      const taskData = {
        title: title.trim(), desc: desc.trim(), priority,
        dueDate: dueDate || todayStr(),
        dueTime: isAllDay ? '09:00' : (dueTime || '09:00'),
        isAllDay,
        reminderOffset: reminder,
        customReminderMins: null,
        cyclicType: cyclic,
        customCyclicMins: null,
        repeatType: repeat,
        repeatWeekdays: [], customRepeat: null, fileData: null,
        done: editTask?.done || false,
      };
      if (editTask?.id && editTask?.title) {
        await updateDoc(doc(db, 'tasks', String(editTask.id)), taskData);
      } else {
        const newId = Date.now();
        taskData.id = newId;
        await setDoc(doc(db, 'tasks', String(newId)), taskData);
      }
      onClose();
    } catch (e) {
      console.error('Error saving task:', e);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const priorityConfig = [
    { value: 3, label: 'Срочно',      cls: 'priority-3' },
    { value: 2, label: 'Скоро',       cls: 'priority-2' },
    { value: 1, label: 'Не срочно',   cls: 'priority-1' },
  ];

  return (
    <>
      <div className="task-modal-overlay" onClick={onClose}>
        <div className="task-modal-box" onClick={e => e.stopPropagation()}>

          {/* ── Header ── */}
          <div className="task-modal-header">
            <button className="icon-btn" onClick={onClose} title="Закрыть (Esc)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <span className="task-modal-esc-hint">ESC</span>
            <button
              className="btn-text primary-text"
              onClick={handleSave}
              disabled={isSaving}
              style={{ opacity: isSaving ? 0.5 : 1, marginLeft: 'auto' }}
            >
              {isSaving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>

          {/* ── Two-column body ── */}
          <div className="task-modal-body">

            {/* Left: Calendar + Time */}
            <div className="task-modal-left">
              <MiniCalendar value={dueDate} onChange={setDueDate} tasks={tasks} />

              <div className="task-modal-allday">
                <span>Весь день</span>
                <label className="switch">
                  <input type="checkbox" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} />
                  <span className="slider round" />
                </label>
              </div>

              <div className="task-modal-time-section">
                <div className="task-modal-time-label">Время</div>
                <TimePicker value={dueTime} onChange={t => { setDueTime(t); setIsAllDay(false); }} />
              </div>

              {tasks.filter(t => t.dueDate === dueDate && !t.done && t.id !== editTask?.id).length > 0 && (
                <div className="selected-date-tasks">
                  <div className="sdt-header">Задачи на этот день:</div>
                  <div className="sdt-list">
                    {tasks.filter(t => t.dueDate === dueDate && !t.done && t.id !== editTask?.id).map(t => (
                      <div key={t.id} className="sdt-item">
                        <div className="sdt-dot" />
                        <span className="sdt-title">{t.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Task details */}
            <div className="task-modal-right">
              {/* Title + Priority */}
              <div className="task-edit-top">
                <div className="task-edit-inputs">
                  <input
                    ref={titleRef}
                    type="text"
                    className="input-title large"
                    placeholder="Новая задача"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } }}
                    autoComplete="off"
                  />
                  <textarea
                    className="transparent-textarea mt-2"
                    rows="3"
                    placeholder="Добавьте детали..."
                    value={desc}
                    onChange={e => setDesc(e.target.value)}
                  />
                </div>
                <div className="priority-selector-col">
                  {priorityConfig.map(pc => (
                    <div
                      key={pc.value}
                      className={`priority-dot ${pc.cls}${priority === pc.value ? ' active' : ''}`}
                      title={pc.label}
                      onClick={() => setPriority(pc.value)}
                    />
                  ))}
                </div>
              </div>

              {/* Properties */}
              <div className="properties-list mt-4">
                
                <div className="property-group">
                  <div className={`property-row ${showRemSheet ? 'active' : ''}`} onClick={() => { setShowRemSheet(!showRemSheet); setShowCyclicSheet(false); setShowRepeatSheet(false); }}>
                    <div className="property-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                      </svg>
                    </div>
                    <div className="property-content">
                      <div className="property-title">{getReminderText(reminder)}</div>
                      <div className="property-subtitle">Напоминание</div>
                    </div>
                  </div>
                  {showRemSheet && (
                    <div className="inline-options-panel">
                      <RadioList name="rem" value={reminder} onChange={v => { setReminder(v); setShowRemSheet(false); }} options={[
                        { value: '-1',  label: 'Без напоминания' },
                        { value: '0',   label: 'Вовремя' },
                        { value: '15',  label: 'За 15 минут' },
                        { value: '30',  label: 'За 30 минут' },
                        { value: '60',  label: 'За 1 час' },
                        { value: '120', label: 'За 2 часа' },
                        { value: '1440',label: 'За 1 день' },
                      ]} />
                    </div>
                  )}
                </div>

                <div className="property-group">
                  <div className={`property-row ${showCyclicSheet ? 'active' : ''}`} onClick={() => { setShowCyclicSheet(!showCyclicSheet); setShowRemSheet(false); setShowRepeatSheet(false); }}>
                    <div className="property-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12A10 10 0 0 0 22 12"/><path d="M12 2A10 10 0 0 0 2 12"/>
                        <polyline points="1 7 5 12 1 12"/>
                      </svg>
                    </div>
                    <div className="property-content">
                      <div className="property-title">{getCyclicText(cyclic)}</div>
                      <div className="property-subtitle">Цикличность</div>
                    </div>
                  </div>
                  {showCyclicSheet && (
                    <div className="inline-options-panel">
                      <RadioList name="cyc" value={cyclic} onChange={v => { setCyclic(v); setShowCyclicSheet(false); }} options={[
                        { value: 'none', label: 'Без цикла' },
                        { value: '60',   label: 'Каждый час' },
                        { value: '120',  label: 'Каждые 2 часа' },
                        { value: '240',  label: 'Каждые 4 часа' },
                      ]} />
                    </div>
                  )}
                </div>

                <div className="property-group">
                  <div className={`property-row ${showRepeatSheet ? 'active' : ''}`} onClick={() => { setShowRepeatSheet(!showRepeatSheet); setShowRemSheet(false); setShowCyclicSheet(false); }}>
                    <div className="property-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/>
                        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M22 14l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                      </svg>
                    </div>
                    <div className="property-content">
                      <div className="property-title">{getRepeatText(repeat)}</div>
                      <div className="property-subtitle">Повтор</div>
                    </div>
                  </div>
                  {showRepeatSheet && (
                    <div className="inline-options-panel">
                      <RadioList name="rep" value={repeat} onChange={v => { setRepeat(v); setShowRepeatSheet(false); }} options={[
                        { value: 'none',    label: 'Не повторяется' },
                        { value: 'daily',   label: 'Каждый день' },
                        { value: 'weekly',  label: 'Каждую неделю' },
                        { value: 'monthly', label: 'Каждый месяц' },
                        { value: 'yearly',  label: 'Каждый год' },
                      ]} />
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

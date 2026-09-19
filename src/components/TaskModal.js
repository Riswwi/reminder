"use client";

import { useState, useRef, useEffect } from 'react';
import { doc, setDoc, updateDoc, collection, onSnapshot } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { pingMobile } from '@/lib/pingMobile';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTH_NAMES = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                     'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const WEEKDAYS_SHORT = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
const todayStr = () => toDateStr(new Date());
const currentTimeStr = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

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
  while (cells.length < 42) cells.push(null);

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
          if (cell === null) return <div key={`e${i}`} className="mc-empty" />;
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
function TimeKeyboardInput({ label, value, max, onChange }) {
  const inputRef = useRef(null);

  const commit = () => {
    const parsed = Number.parseInt(inputRef.current?.value || '0', 10);
    const nextValue = Number.isFinite(parsed) ? Math.min(max, Math.max(0, parsed)) : 0;
    if (inputRef.current) inputRef.current.value = String(nextValue).padStart(2, '0');
    onChange(nextValue);
  };

  return (
    <label className="tp-keyboard-field">
      <span>{label}</span>
      <input
        key={value}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        defaultValue={String(value).padStart(2, '0')}
        aria-label={label}
        onFocus={event => event.currentTarget.select()}
        onInput={event => {
          event.currentTarget.value = event.currentTarget.value.replace(/\D/g, '').slice(0, 2);
        }}
        onBlur={commit}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
            event.currentTarget.blur();
          }
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            const direction = event.key === 'ArrowUp' ? 1 : -1;
            const parsed = Number.parseInt(event.currentTarget.value || String(value), 10);
            const current = Number.isFinite(parsed) ? Math.min(max, Math.max(0, parsed)) : 0;
            const nextValue = (current + direction + max + 1) % (max + 1);
            event.currentTarget.value = String(nextValue).padStart(2, '0');
            onChange(nextValue);
          }
        }}
      />
    </label>
  );
}

function TimeWheel({ label, value, max, onChange }) {
  const wheelRef = useRef(null);
  const settleTimerRef = useRef(null);
  const digitBufferRef = useRef('');
  const digitTimerRef = useRef(null);
  const wheelGestureLockedRef = useRef(false);
  const wheelUnlockTimerRef = useRef(null);
  const dragRef = useRef({ active: false, startY: 0, startScrollTop: 0, moved: false });
  const values = Array.from({ length: max + 1 }, (_, index) => index);

  const scrollToValue = (nextValue, behavior = 'smooth') => {
    const wheel = wheelRef.current;
    const target = wheel?.querySelector(`[data-value="${nextValue}"]`);
    if (!wheel || !target) return;
    const wheelRect = wheel.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const distanceToCenter =
      targetRect.top + targetRect.height / 2 -
      (wheelRect.top + wheelRect.height / 2);
    wheel.scrollTo({ top: wheel.scrollTop + distanceToCenter, behavior });
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => scrollToValue(value, 'auto'));
    return () => cancelAnimationFrame(frame);
  }, [value]);

  useEffect(() => () => {
    clearTimeout(settleTimerRef.current);
    clearTimeout(digitTimerRef.current);
    clearTimeout(wheelUnlockTimerRef.current);
  }, []);

  const selectCentered = () => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    const wheelRect = wheel.getBoundingClientRect();
    const center = wheelRect.top + wheelRect.height / 2;
    const items = Array.from(wheel.querySelectorAll('[data-value]'));
    const selected = items.reduce((closest, item) => {
      const itemRect = item.getBoundingClientRect();
      const distance = Math.abs(itemRect.top + itemRect.height / 2 - center);
      return !closest || distance < closest.distance ? { item, distance } : closest;
    }, null);
    if (!selected) return;
    const nextValue = Number(selected.item.dataset.value);
    if (nextValue !== value) onChange(nextValue);
    scrollToValue(nextValue);
  };

  const changeBy = (delta, behavior = 'smooth') => {
    const nextValue = (value + delta + max + 1) % (max + 1);
    onChange(nextValue);
    scrollToValue(nextValue, behavior);
  };

  return (
    <div className="tp-wheel-column">
      <div className="tp-wheel-label">{label}</div>
      <div
        ref={wheelRef}
        className="tp-wheel"
        tabIndex={0}
        role="spinbutton"
        aria-label={label === 'ЧАСЫ' ? 'Выбор часов' : 'Выбор минут'}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        onWheel={event => {
          event.preventDefault();
          event.stopPropagation();
          if (event.deltaY === 0) return;
          clearTimeout(wheelUnlockTimerRef.current);
          if (!wheelGestureLockedRef.current) {
            wheelGestureLockedRef.current = true;
            changeBy(event.deltaY > 0 ? 1 : -1, 'auto');
          }
          wheelUnlockTimerRef.current = setTimeout(() => {
            wheelGestureLockedRef.current = false;
          }, 120);
        }}
        onScroll={() => {
          clearTimeout(settleTimerRef.current);
          if (!dragRef.current.active && !wheelGestureLockedRef.current) {
            settleTimerRef.current = setTimeout(selectCentered, 160);
          }
        }}
        onPointerDown={event => {
          if (event.pointerType !== 'mouse' || event.button !== 0) return;
          clearTimeout(settleTimerRef.current);
          dragRef.current = {
            active: true,
            startY: event.clientY,
            startScrollTop: event.currentTarget.scrollTop,
            moved: false,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.classList.add('dragging');
        }}
        onPointerMove={event => {
          if (!dragRef.current.active) return;
          const distance = event.clientY - dragRef.current.startY;
          if (Math.abs(distance) > 3) dragRef.current.moved = true;
          event.currentTarget.scrollTop = dragRef.current.startScrollTop - distance;
          event.preventDefault();
        }}
        onPointerUp={event => {
          if (!dragRef.current.active) return;
          dragRef.current.active = false;
          event.currentTarget.classList.remove('dragging');
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          settleTimerRef.current = setTimeout(selectCentered, 30);
          setTimeout(() => { dragRef.current.moved = false; }, 0);
        }}
        onPointerCancel={event => {
          dragRef.current.active = false;
          dragRef.current.moved = false;
          event.currentTarget.classList.remove('dragging');
        }}
        onKeyDown={event => {
          if (event.key === 'ArrowUp') { event.preventDefault(); changeBy(-1); }
          if (event.key === 'ArrowDown') { event.preventDefault(); changeBy(1); }
          if (/^\d$/.test(event.key)) {
            digitBufferRef.current = `${digitBufferRef.current}${event.key}`.slice(-2);
            clearTimeout(digitTimerRef.current);
            digitTimerRef.current = setTimeout(() => { digitBufferRef.current = ''; }, 700);
            const typedValue = Number(digitBufferRef.current);
            if (typedValue <= max) {
              onChange(typedValue);
              scrollToValue(typedValue);
            }
          }
        }}
      >
        {values.map(itemValue => (
          <button
            key={itemValue}
            type="button"
            data-value={itemValue}
            className={`tp-wheel-value${itemValue === value ? ' active' : ''}`}
            onClick={() => {
              if (dragRef.current.moved) {
                dragRef.current.moved = false;
                return;
              }
              onChange(itemValue);
              scrollToValue(itemValue);
            }}
          >
            {String(itemValue).padStart(2, '0')}
          </button>
        ))}
      </div>
    </div>
  );
}

function TimePicker({ value, onChange }) {
  const [h, m] = (value || '09:00').split(':').map(Number);

  const set = (newH, newM) => {
    onChange(`${String(newH).padStart(2,'0')}:${String(newM).padStart(2,'0')}`);
  };

  return (
    <div className="tp-wheel-panel">
      <TimeKeyboardInput label="Ввод часов" value={h} max={23} onChange={newH => set(newH, m)} />
      <TimeWheel label="ЧАСЫ" value={h} max={23} onChange={newH => set(newH, m)} />
      <span className="tp-wheel-separator">:</span>
      <TimeWheel label="МИНУТЫ" value={m} max={59} onChange={newM => set(h, newM)} />
      <TimeKeyboardInput label="Ввод минут" value={m} max={59} onChange={newM => set(h, newM)} />
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
  const [contentMode, setContentMode] = useState('description');
  const [checklist, setChecklist] = useState([]);
  const [priority, setPriority] = useState(1);
  const [isAllDay, setIsAllDay] = useState(true);
  const [dueDate, setDueDate]   = useState(todayStr());
  const [dueTime, setDueTime]   = useState(currentTimeStr);
  const [reminder, setReminder] = useState('-1');
  const [cyclic, setCyclic]     = useState('none');
  const [repeat, setRepeat]     = useState('none');
  const [isSaving, setIsSaving] = useState(false);
  const [tasks, setTasks]       = useState([]);
  const [hiddenTaskCount, setHiddenTaskCount] = useState(0);

  const [showRemSheet,    setShowRemSheet]    = useState(false);
  const [showCyclicSheet, setShowCyclicSheet] = useState(false);
  const [showRepeatSheet, setShowRepeatSheet] = useState(false);

  const titleRef = useRef(null);
  const selectedTasksListRef = useRef(null);

  const selectedDateTasks = tasks.filter(
    task => task.dueDate === dueDate && !task.done && task.id !== editTask?.id
  );

  useEffect(() => {
    const list = selectedTasksListRef.current;
    if (!isOpen || !list) {
      setHiddenTaskCount(0);
      return undefined;
    }

    const updateHiddenTaskCount = () => {
      const listBottom = list.getBoundingClientRect().bottom;
      const hiddenBelow = Array.from(list.querySelectorAll('.sdt-item'))
        .filter(item => item.getBoundingClientRect().bottom > listBottom + 1)
        .length;
      setHiddenTaskCount(hiddenBelow);
    };

    const frame = requestAnimationFrame(updateHiddenTaskCount);
    const resizeObserver = new ResizeObserver(updateHiddenTaskCount);
    resizeObserver.observe(list);
    Array.from(list.children).forEach(item => resizeObserver.observe(item));
    list.addEventListener('scroll', updateHiddenTaskCount, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      list.removeEventListener('scroll', updateHiddenTaskCount);
    };
  }, [isOpen, dueDate, tasks, editTask?.id]);

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
      snapshot.forEach(d => arr.push({ id: String(d.id), ...d.data() }));
      setTasks(arr);
    });
    return () => unsub();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const initTimer = setTimeout(() => {
      const td = todayStr();
      if (editTask && editTask.title) {
        setTitle(editTask.title || '');
        setDesc(editTask.desc || '');
        setContentMode(editTask.contentMode === 'checklist' ? 'checklist' : 'description');
        setChecklist(Array.isArray(editTask.checklist) ? editTask.checklist : []);
        setPriority(editTask.priority || 1);
        setIsAllDay(editTask.isAllDay !== false);
        setDueDate(editTask.dueDate || td);
        setDueTime(editTask.dueTime || '09:00');
        setReminder(editTask.reminderOffset !== null ? String(editTask.reminderOffset) : '-1');
        setCyclic(editTask.cyclicType || 'none');
        setRepeat(editTask.repeatType || 'none');
      } else {
        setTitle('');
        setDesc('');
        setContentMode('description');
        setChecklist([]);
        setPriority(1);
        setIsAllDay(true);
        setDueDate(editTask?.dueDate || td);
        setDueTime(currentTimeStr());
        setReminder('-1');
        setCyclic('none');
        setRepeat('none');
      }
      setIsSaving(false);
      requestAnimationFrame(() => {
        titleRef.current?.focus();
        titleRef.current?.select();
      });
    }, 0);
    return () => clearTimeout(initTimer);
  }, [isOpen, editTask]);


  const handleSave = async () => {
    if (!title.trim() || isSaving) return;
    setIsSaving(true);
    try {
      const taskData = {
        title: title.trim(), desc: desc.trim(), priority,
        contentMode,
        checklist: contentMode === 'checklist'
          ? checklist
              .map(item => ({ id: item.id || crypto.randomUUID(), text: (item.text || '').trim(), done: Boolean(item.done) }))
              .filter(item => item.text)
          : [],
        dueDate: dueDate || todayStr(),
        dueTime: isAllDay ? null : (dueTime || currentTimeStr()),
        isAllDay,
        reminderOffset: reminder !== '-1' ? parseInt(reminder) : null,
        customReminderMins: null,
        cyclicType: cyclic !== 'none' ? cyclic : null,
        customCyclicMins: null,
        repeatType: repeat !== 'none' ? repeat : null,
        repeatWeekdays: [], customRepeat: null,
        fileData: null,
        done: editTask?.done || false,
      };
      let savedTaskId;
      if (editTask?.id && editTask?.title) {
        savedTaskId = String(editTask.id);
        await updateDoc(doc(db, 'tasks', savedTaskId), taskData);
      } else {
        const newId = Date.now();
        savedTaskId = String(newId);
        taskData.id = newId;
        await setDoc(doc(db, 'tasks', savedTaskId), taskData);
      }
      
      // Notify mobile app to sync
      void pingMobile(savedTaskId, 'upsert');
      
      onClose();
    } catch (e) {
      console.error('Error saving task:', e);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const updateChecklistItem = (id, patch) => {
    setChecklist(items => items.map(item => item.id === id ? { ...item, ...patch } : item));
  };

  const addChecklistItem = (afterId = null) => {
    const newItem = { id: crypto.randomUUID(), text: '', done: false };
    setChecklist(items => {
      if (!afterId) return [...items, newItem];
      const index = items.findIndex(item => item.id === afterId);
      return index < 0 ? [...items, newItem] : [...items.slice(0, index + 1), newItem, ...items.slice(index + 1)];
    });
    requestAnimationFrame(() => document.querySelector(`[data-checklist-id="${newItem.id}"]`)?.focus());
  };

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

          {/* ── Body ── */}
          <div className="task-modal-body">

            {/* Leftmost: Tasks for selected date */}
            <div className="task-modal-sdt-col">
              <div className="sdt-header">Задачи на {dueDate.split('-').reverse().join('.')}:</div>
              {selectedDateTasks.length > 0 ? (
                <div className="sdt-list" ref={selectedTasksListRef}>
                  {selectedDateTasks.map(t => (
                    <div key={t.id} className="sdt-item">
                      <div className="sdt-dot" />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="sdt-title">{t.title}</span>
                        {!t.isAllDay && t.dueTime && (
                          <span className="sdt-time">{t.dueTime}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 12 }}>
                  Задач на этот день нет
                </div>
              )}
              {hiddenTaskCount > 0 && (
                <div className="sdt-more">Ещё {hiddenTaskCount} задач</div>
              )}
            </div>

            {/* Left: Calendar + Time */}
            <div className="task-modal-left">
              <MiniCalendar value={dueDate} onChange={setDueDate} tasks={tasks} />

              <div className="task-modal-allday">
                <span>Весь день</span>
                <label className="switch">
                  <input type="checkbox" checked={isAllDay} onChange={e => {
                    const allDay = e.target.checked;
                    setIsAllDay(allDay);
                    if (!allDay) {
                      setDueTime(currentTimeStr());
                      if (reminder === '-1') setReminder('0');
                    }
                    else if (allDay) setReminder('-1');
                  }} />
                  <span className="slider round" />
                </label>
              </div>

              {!isAllDay && (
                <div className="task-modal-time-section">
                  <div className="task-modal-time-label">Время</div>
                  <TimePicker value={dueTime} onChange={t => {
                    setDueTime(t);
                    if (reminder === '-1') setReminder('0');
                  }} />
                </div>
              )}
            </div>

            {/* Right: Task details */}
            <div className="task-modal-right">
              {/* Title + Priority */}
              <div className="task-edit-top">
                <div className="task-edit-inputs">
                  <textarea
                    ref={titleRef}
                    autoFocus
                    className="input-title large"
                    placeholder="Новая задача"
                    value={title}
                    rows={1}
                    style={{ resize: 'none', overflow: 'hidden' }}
                    onChange={e => {
                      setTitle(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } }}
                    autoComplete="off"
                  />
                  <div className="task-content-switch" role="group" aria-label="Тип описания">
                    <button type="button" className={contentMode === 'description' ? 'active' : ''} onClick={() => setContentMode('description')}>Описание</button>
                    <button type="button" className={contentMode === 'checklist' ? 'active' : ''} onClick={() => setContentMode('checklist')}>To-do list</button>
                  </div>
                  {contentMode === 'description' ? (
                    <textarea
                      className="transparent-textarea mt-2"
                      rows="3"
                      placeholder="Добавьте детали..."
                      value={desc}
                      style={{ minHeight: '64px', overflow: 'hidden' }}
                      onChange={e => {
                        setDesc(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                      }}
                    />
                  ) : (
                    <div className="checklist-editor mt-2">
                      {checklist.map((item, index) => (
                        <div className={`checklist-editor-item${item.done ? ' done' : ''}`} key={item.id}>
                          <button type="button" className="checklist-box" aria-label="Отметить пункт" onClick={() => updateChecklistItem(item.id, { done: !item.done })}>{item.done && '✓'}</button>
                          <textarea data-checklist-id={item.id} autoFocus={index === checklist.length - 1 && !item.text} rows={1} value={item.text} placeholder="Новый пункт" onChange={event => updateChecklistItem(item.id, { text: event.target.value })} onKeyDown={event => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              addChecklistItem(item.id);
                            }
                          }} />
                          <button type="button" className="checklist-remove" aria-label="Удалить пункт" onClick={() => setChecklist(items => items.filter(candidate => candidate.id !== item.id))}>×</button>
                        </div>
                      ))}
                      <button type="button" className="checklist-add" onClick={addChecklistItem}>+ Добавить пункт</button>
                    </div>
                  )}
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

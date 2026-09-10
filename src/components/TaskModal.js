"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTH_NAMES = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                     'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const WEEKDAYS_SHORT = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

// ─── Inline Calendar Picker ───────────────────────────────────────────────────
function CalendarPicker({ value, onChange }) {
  const parsed = value ? new Date(value + 'T00:00:00') : new Date();
  const [nav, setNav] = useState(() => {
    const d = new Date(parsed); d.setDate(1); return d;
  });

  const year = nav.getFullYear();
  const month = nav.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let firstIdx = new Date(year, month, 1).getDay() - 1;
  if (firstIdx === -1) firstIdx = 6;

  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = toDateStr(today);

  const cells = [];
  for (let i = 0; i < firstIdx; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells.push({ d, ds, isToday: ds === todayStr, isSelected: ds === value });
  }

  return (
    <div className="inline-calendar">
      <div className="inline-cal-header">
        <button
          type="button"
          className="icon-btn small"
          onClick={() => setNav(n => new Date(n.getFullYear(), n.getMonth()-1, 1))}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="inline-cal-month">{MONTH_NAMES[month]} {year}</span>
        <button
          type="button"
          className="icon-btn small"
          onClick={() => setNav(n => new Date(n.getFullYear(), n.getMonth()+1, 1))}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      <div className="inline-cal-grid">
        {WEEKDAYS_SHORT.map(w => <div key={w} className="inline-cal-weekday">{w}</div>)}
        {cells.map((cell, i) =>
          cell === null
            ? <div key={`e${i}`} />
            : (
              <button
                key={cell.ds}
                type="button"
                className={`inline-cal-day${cell.isToday ? ' today' : ''}${cell.isSelected ? ' selected' : ''}`}
                onClick={() => onChange(cell.ds)}
              >
                {cell.d}
              </button>
            )
        )}
      </div>
      <div className="inline-cal-footer">
        <button
          type="button"
          className="btn-text primary-text"
          style={{ fontSize: 13 }}
          onClick={() => { onChange(todayStr); setNav(new Date()); }}
        >
          Сегодня
        </button>
      </div>
    </div>
  );
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

const formatDateLabel = (ds, isAllDay, time) => {
  if (!ds) return 'Выбрать дату';
  const date = new Date(ds + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
  let label;
  if (date.getTime() === today.getTime()) label = 'Сегодня';
  else if (date.getTime() === tomorrow.getTime()) label = 'Завтра';
  else label = date.toLocaleDateString('ru-RU', { day:'numeric', month:'short' });
  return isAllDay ? `${label}, Весь день` : `${label}, ${time}`;
};

const getReminderText = (rem) => {
  if (rem === '-1') return 'Без напоминания';
  if (rem === '0')  return 'Вовремя';
  if (rem === '15') return 'За 15 минут';
  if (rem === '30') return 'За 30 минут';
  if (rem === '60') return 'За 1 час';
  if (rem === '120') return 'За 2 часа';
  if (rem === '1440') return 'За 1 день';
  return 'Напоминание';
};

// ─── BottomSheet wrapper ──────────────────────────────────────────────────────
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

// ─── RadioList ────────────────────────────────────────────────────────────────
function RadioList({ name, value, onChange, options }) {
  return (
    <div className="radio-list">
      {options.map(opt => (
        <label key={opt.value} className="radio-item">
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={e => onChange(e.target.value)}
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

// ─── TaskModal ────────────────────────────────────────────────────────────────
export default function TaskModal({ isOpen, onClose, editTask = null }) {
  const [title, setTitle]           = useState('');
  const [desc, setDesc]             = useState('');
  const [priority, setPriority]     = useState(1);
  const [isAllDay, setIsAllDay]     = useState(true);
  const [dueDate, setDueDate]       = useState('');
  const [dueTime, setDueTime]       = useState('09:00');
  const [reminderOffset, setReminderOffset] = useState('-1');
  const [cyclicType, setCyclicType] = useState('none');
  const [repeatType, setRepeatType] = useState('none');

  const [showDateSheet,     setShowDateSheet]     = useState(false);
  const [showReminderSheet, setShowReminderSheet] = useState(false);
  const [showCyclicSheet,   setShowCyclicSheet]   = useState(false);
  const [showRepeatSheet,   setShowRepeatSheet]   = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const titleRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const now = new Date();
    const todayStr = toDateStr(now);
    if (editTask) {
      setTitle(editTask.title || '');
      setDesc(editTask.desc || '');
      setPriority(editTask.priority || 1);
      setIsAllDay(editTask.isAllDay !== false);
      setDueDate(editTask.dueDate || todayStr);
      setDueTime(editTask.dueTime || '09:00');
      setReminderOffset(String(editTask.reminderOffset ?? '-1'));
      setCyclicType(editTask.cyclicType || 'none');
      setRepeatType(editTask.repeatType || 'none');
    } else {
      setTitle('');
      setDesc('');
      setPriority(1);
      setIsAllDay(true);
      // If opened from calendar day – use that date
      setDueDate(editTask?.dueDate || todayStr);
      setDueTime('09:00');
      setReminderOffset('-1');
      setCyclicType('none');
      setRepeatType('none');
    }
    setTimeout(() => { titleRef.current?.focus(); titleRef.current?.select(); }, 60);
  }, [isOpen, editTask?.id]);

  const handleSave = async () => {
    if (!title.trim() || isSaving) return;
    setIsSaving(true);
    try {
      const now = new Date();
      const todayStr = toDateStr(now);
      const taskData = {
        title: title.trim(),
        desc: desc.trim(),
        priority,
        dueDate: dueDate || todayStr,
        dueTime: isAllDay ? '09:00' : (dueTime || '09:00'),
        isAllDay,
        reminderOffset,
        customReminderMins: null,
        cyclicType,
        customCyclicMins: null,
        repeatType,
        repeatWeekdays: [],
        customRepeat: null,
        fileData: null,
        done: editTask ? (editTask.done || false) : false,
      };

      if (editTask && editTask.id && !editTask.dueDate?.includes('-') === false) {
        // editing existing task
        await updateDoc(doc(db, 'tasks', String(editTask.id)), taskData);
      } else if (editTask && editTask.id && typeof editTask.id === 'number') {
        await updateDoc(doc(db, 'tasks', String(editTask.id)), taskData);
      } else if (editTask && editTask.id && typeof editTask.id === 'string' && editTask.title) {
        await updateDoc(doc(db, 'tasks', editTask.id), taskData);
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
    { value: 3, label: 'Срочно',           color: '#FF453A', cls: 'priority-3' },
    { value: 2, label: 'В скором времени', color: '#FFD60A', cls: 'priority-2' },
    { value: 1, label: 'Не срочно',        color: '#0A84FF', cls: 'priority-1' },
  ];

  return (
    <>
      {/* ── Main modal ── */}
      <div className="full-modal" onClick={e => e.stopPropagation()}>
        <div className="full-modal-header">
          <button className="icon-btn" aria-label="Закрыть" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <button
            className="btn-text primary-text"
            aria-label="Сохранить"
            onClick={handleSave}
            disabled={isSaving}
            style={{ opacity: isSaving ? 0.5 : 1 }}
          >
            {isSaving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>

        <div className="full-modal-content scrollable">
          {/* Title + priority dots */}
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
                rows="2"
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

          {/* Properties list */}
          <div className="properties-list mt-4">
            {/* Date & time row */}
            <div className="property-row" onClick={() => setShowDateSheet(v => !v)}>
              <div className="property-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div className="property-content">
                <div className="property-title">{formatDateLabel(dueDate, isAllDay, dueTime)}</div>
              </div>
              <div className="property-action">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width:16, height:16, color:'var(--text-muted)', transform: showDateSheet ? 'rotate(90deg)' : 'none', transition:'transform 0.2s' }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            </div>

            {/* Inline calendar (shown in-place, no bottom sheet on desktop) */}
            {showDateSheet && (
              <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', background: 'var(--surface-light)' }}>
                <CalendarPicker value={dueDate} onChange={ds => setDueDate(ds)} />
                <div style={{ height: 1, background: 'var(--border-color)', margin: '16px 0' }} />
                {/* All day toggle */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0' }}>
                  <span style={{ fontSize:16, color:'var(--text-color)' }}>Весь день</span>
                  <label className="switch">
                    <input type="checkbox" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} />
                    <span className="slider round" />
                  </label>
                </div>
                {!isAllDay && (
                  <div style={{ marginTop: 16 }}>
                    <label style={{ display:'block', fontSize:13, color:'var(--text-muted)', marginBottom:8 }}>Время</label>
                    <input
                      type="time"
                      className="styled-input w-100"
                      value={dueTime}
                      onChange={e => setDueTime(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Reminder row */}
            <div className="property-row" onClick={() => setShowReminderSheet(true)}>
              <div className="property-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>
              <div className="property-content">
                <div className="property-title">{getReminderText(reminderOffset)}</div>
                <div className="property-subtitle">Время до задачи</div>
              </div>
            </div>

            {/* Cyclic row */}
            <div className="property-row" onClick={() => setShowCyclicSheet(true)}>
              <div className="property-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12A10 10 0 0 0 22 12"/><path d="M12 2A10 10 0 0 0 2 12"/>
                  <polyline points="1 7 5 12 1 12"/>
                </svg>
              </div>
              <div className="property-content">
                <div className="property-title">
                  {cyclicType === 'none' ? 'Без цикла' : cyclicType === '60' ? 'Каждый час' : cyclicType === '120' ? 'Каждые 2 часа' : cyclicType === '240' ? 'Каждые 4 часа' : 'Цикл'}
                </div>
                <div className="property-subtitle">Цикличное напоминание</div>
              </div>
            </div>

            {/* Repeat row */}
            <div className="property-row" onClick={() => setShowRepeatSheet(true)}>
              <div className="property-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M22 14l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                </svg>
              </div>
              <div className="property-content">
                <div className="property-title">
                  {repeatType === 'none' ? 'Не повторяется' : repeatType === 'daily' ? 'Каждый день' : repeatType === 'weekly' ? 'Каждую неделю' : repeatType === 'monthly' ? 'Каждый месяц' : 'Каждый год'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom sheets ── */}
      <BottomSheet isOpen={showReminderSheet} onClose={() => setShowReminderSheet(false)} title="Напоминание">
        <RadioList
          name="rem"
          value={reminderOffset}
          onChange={setReminderOffset}
          options={[
            { value: '-1',  label: 'Без напоминания' },
            { value: '0',   label: 'Вовремя' },
            { value: '15',  label: 'За 15 минут' },
            { value: '30',  label: 'За 30 минут' },
            { value: '60',  label: 'За 1 час' },
            { value: '120', label: 'За 2 часа' },
            { value: '1440',label: 'За 1 день' },
          ]}
        />
      </BottomSheet>

      <BottomSheet isOpen={showCyclicSheet} onClose={() => setShowCyclicSheet(false)} title="Цикличность">
        <RadioList
          name="cyc"
          value={cyclicType}
          onChange={setCyclicType}
          options={[
            { value: 'none', label: 'Без цикла' },
            { value: '60',   label: 'Каждый час' },
            { value: '120',  label: 'Каждые 2 часа' },
            { value: '240',  label: 'Каждые 4 часа' },
          ]}
        />
      </BottomSheet>

      <BottomSheet isOpen={showRepeatSheet} onClose={() => setShowRepeatSheet(false)} title="Повтор">
        <RadioList
          name="rep"
          value={repeatType}
          onChange={setRepeatType}
          options={[
            { value: 'none',    label: 'Не повторяется' },
            { value: 'daily',   label: 'Каждый день' },
            { value: 'weekly',  label: 'Каждую неделю' },
            { value: 'monthly', label: 'Каждый месяц' },
            { value: 'yearly',  label: 'Каждый год' },
          ]}
        />
      </BottomSheet>
    </>
  );
}

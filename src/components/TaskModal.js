"use client";

import { useState, useRef, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function TaskModal({ isOpen, onClose }) {
  const [title, setTitle] = useState('Новая задача');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState(1);
  const [isAllDay, setIsAllDay] = useState(true);
  const [reminderOffset, setReminderOffset] = useState("-1");
  const [cyclicType, setCyclicType] = useState("none");
  const [repeatType, setRepeatType] = useState("none");

  // Bottom sheets toggles
  const [showReminderSheet, setShowReminderSheet] = useState(false);

  const titleRef = useRef(null);

  useEffect(() => {
    if (isOpen && titleRef.current) {
      setTimeout(() => {
        titleRef.current.focus();
        titleRef.current.select();
      }, 50);
    } else if (!isOpen) {
      setTitle('Новая задача'); // Reset on close
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!title.trim()) return;
    try {
      const newId = Date.now();
      const taskRef = doc(db, "tasks", String(newId));
      
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

      // Match APK schema exactly for sync
      await setDoc(taskRef, {
        id: newId,
        title,
        desc,
        priority,
        dueDate: todayStr, // simplified for now
        dueTime: "09:00",
        isAllDay,
        reminderOffset,
        customReminderMins: null,
        cyclicType,
        customCyclicMins: null,
        repeatType,
        repeatWeekdays: [],
        customRepeat: null,
        done: false,
        fileData: null
      });

      setTitle('');
      setDesc('');
      setPriority(1);
      setIsAllDay(true);
      setReminderOffset("-1");
      onClose();
    } catch (e) {
      console.error("Error adding task: ", e);
    }
  };

  const getReminderText = (rem) => {
    if (rem === "-1") return "Без напоминания";
    if (rem === "0") return "Вовремя";
    if (rem === "15") return "За 15 минут";
    if (rem === "60") return "За 1 час";
    return "Напоминание";
  };

  return (
    <>
      <div className={`full-modal ${isOpen ? '' : 'hidden'}`}>
        <div className="full-modal-header">
          <button className="icon-btn" aria-label="Закрыть" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
          <button className="btn-text primary-text" aria-label="Сохранить" onClick={handleSave}>Сохранить</button>
        </div>
        
        <div className="full-modal-content scrollable">
          <div className="task-edit-top">
            <div className="task-edit-inputs">
              <input 
                ref={titleRef}
                type="text" 
                className="input-title large" 
                placeholder="Новая задача" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoComplete="off" 
              />
              <textarea 
                className="transparent-textarea mt-2" 
                rows="2" 
                placeholder="Добавьте детали..."
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              ></textarea>
            </div>
            <div className="priority-selector-col">
              <div className={`priority-dot priority-3 ${priority === 3 ? 'active' : ''}`} onClick={() => setPriority(3)} title="Срочно"></div>
              <div className={`priority-dot priority-2 ${priority === 2 ? 'active' : ''}`} onClick={() => setPriority(2)} title="В скором времени"></div>
              <div className={`priority-dot priority-1 ${priority === 1 ? 'active' : ''}`} onClick={() => setPriority(1)} title="Не срочно"></div>
            </div>
          </div>

          <div className="properties-list mt-4">
            <div className="property-row">
              <div className="property-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></div>
              <div className="property-content">
                <div className="property-title">Сегодня{isAllDay ? ', Весь день' : ''}</div>
              </div>
              <div className="property-action" onClick={(e) => e.stopPropagation()}>
                <label className="switch">
                  <input type="checkbox" checked={isAllDay} onChange={(e) => setIsAllDay(e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>
            </div>

            <div className="property-row" onClick={() => setShowReminderSheet(true)}>
              <div className="property-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg></div>
              <div className="property-content">
                <div className="property-title">{getReminderText(reminderOffset)}</div>
                <div className="property-subtitle">Время до задачи</div>
              </div>
            </div>

            <div className="property-row" onClick={() => alert("Эта кнопка пока не подключена на вебе, но скоро будет!")}>
              <div className="property-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12A10 10 0 0 0 22 12"></path><path d="M12 2A10 10 0 0 0 2 12"></path><polyline points="1 7 5 12 1 12"></polyline></svg></div>
              <div className="property-content">
                <div className="property-title">Без цикла</div>
                <div className="property-subtitle">Цикличное напоминание</div>
              </div>
            </div>

            <div className="property-row" onClick={() => alert("Эта кнопка пока не подключена на вебе, но скоро будет!")}>
              <div className="property-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M22 14l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg></div>
              <div className="property-content">
                <div className="property-title">Не повторяется</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reminder Bottom Sheet */}
      <div className={`bottom-sheet-overlay ${showReminderSheet ? '' : 'hidden'}`} onClick={() => setShowReminderSheet(false)}>
        <div className="bottom-sheet-content" onClick={(e) => e.stopPropagation()}>
          <div className="sheet-header">
            <h3>Напоминание</h3>
            <button className="btn-text primary-text" onClick={() => setShowReminderSheet(false)}>Готово</button>
          </div>
          <div className="sheet-body scrollable-body">
            <span className="section-label">Выберите время</span>
            <div className="radio-list">
              <label className="radio-item">
                <input type="radio" name="rem" value="-1" checked={reminderOffset === "-1"} onChange={(e) => setReminderOffset(e.target.value)} />
                <span>Без напоминания</span>
              </label>
              <label className="radio-item">
                <input type="radio" name="rem" value="0" checked={reminderOffset === "0"} onChange={(e) => setReminderOffset(e.target.value)} />
                <span>Вовремя</span>
              </label>
              <label className="radio-item">
                <input type="radio" name="rem" value="15" checked={reminderOffset === "15"} onChange={(e) => setReminderOffset(e.target.value)} />
                <span>За 15 минут</span>
              </label>
              <label className="radio-item">
                <input type="radio" name="rem" value="60" checked={reminderOffset === "60"} onChange={(e) => setReminderOffset(e.target.value)} />
                <span>За 1 час</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

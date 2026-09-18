"use client";

import { useState, useEffect, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { pingMobile } from '@/lib/pingMobile';

export default function ViewTaskPopup({ isOpen, onClose, task }) {
  const [desc, setDesc] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !task) return;
    const syncTimer = setTimeout(() => {
      setDesc(task.desc || '');
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
      });
    }, 0);
    return () => clearTimeout(syncTimer);
  }, [isOpen, task]);

  if (!isOpen || !task) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'tasks', String(task.id)), {
        desc: desc.trim()
      });
      // Notify mobile app to sync
      void pingMobile(task.id, 'upsert');
      onClose();
    } catch (e) {
      console.error('Error updating description:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const priNames = { 1: 'Не срочно', 2: 'В скором времени', 3: 'Срочно' };
  const priColors = { 1: '#5E5CE6', 2: '#FFD60A', 3: '#FF453A' };

  let dateInfo = '';
  if (task.dueDate) {
    const d = new Date(task.dueDate + 'T00:00:00');
    const td = new Date();
    let prefix = '';
    if (d.toDateString() === td.toDateString()) prefix = 'Сегодня';
    else {
      const tom = new Date(td); tom.setDate(td.getDate() + 1);
      if (d.toDateString() === tom.toDateString()) prefix = 'Завтра';
      else prefix = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    dateInfo = task.isAllDay ? `${prefix}, Весь день` : `${prefix}, ${task.dueTime || ''}`;
  }

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-content" onClick={e => e.stopPropagation()}>
        <div className="popup-header">
          <h3 className="popup-title">{task.title}</h3>
          <button className="icon-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
          <span>{dateInfo}</span>
          <span style={{ fontWeight: 'bold', color: priColors[task.priority || 1] }}>
            {priNames[task.priority || 1]}
          </span>
        </div>
        <div className="popup-body">
          <textarea
            ref={textareaRef}
            className="transparent-textarea view-desc-edit"
            placeholder="Добавьте описание задачи..."
            value={desc}
            onChange={(e) => {
              setDesc(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
          />
        </div>
        <div className="popup-footer">
          <button 
            className="btn btn-primary w-100" 
            onClick={handleSave} 
            disabled={isSaving}
          >
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}

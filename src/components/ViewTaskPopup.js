"use client";

import { useState, useEffect, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { pingMobile } from '@/lib/pingMobile';

export default function ViewTaskPopup({ isOpen, onClose, task }) {
  const [desc, setDesc] = useState('');
  const [checklist, setChecklist] = useState([]);
  const [contentMode, setContentMode] = useState('checklist');
  const [isEmptyTask, setIsEmptyTask] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef(null);

  const newChecklistItem = () => ({
    id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: '',
    done: false
  });

  useEffect(() => {
    if (!isOpen || !task) return;
    const syncTimer = setTimeout(() => {
      const storedDesc = task.desc || '';
      const storedChecklist = Array.isArray(task.checklist) ? task.checklist : [];
      const hasContent = Boolean(storedDesc.trim()) || storedChecklist.some(item => String(item?.text || '').trim());
      setDesc(storedDesc);
      setIsEmptyTask(!hasContent);
      setContentMode(hasContent && task.contentMode === 'description' ? 'description' : 'checklist');
      setChecklist(hasContent ? storedChecklist : [newChecklistItem()]);
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
        desc: contentMode === 'description' ? desc.trim() : '',
        contentMode,
        checklist: contentMode === 'checklist'
          ? checklist.map(item => ({ ...item, text: String(item.text || '').trim() })).filter(item => item.text)
          : []
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

  const toggleChecklistItem = async (itemId) => {
    const nextChecklist = checklist.map(item => item.id === itemId ? { ...item, done: !item.done } : item);
    setChecklist(nextChecklist);
    try {
      await updateDoc(doc(db, 'tasks', String(task.id)), { checklist: nextChecklist });
      void pingMobile(task.id, 'upsert');
    } catch (e) {
      console.error('Error updating checklist:', e);
      setChecklist(checklist);
    }
  };

  const updateChecklistItem = (itemId, patch) => {
    setChecklist(items => items.map(item => item.id === itemId ? { ...item, ...patch } : item));
  };

  const addChecklistItem = (afterId = null) => {
    const item = newChecklistItem();
    setChecklist(items => {
      const index = afterId ? items.findIndex(candidate => candidate.id === afterId) : -1;
      if (index < 0) return [...items, item];
      return [...items.slice(0, index + 1), item, ...items.slice(index + 1)];
    });
    requestAnimationFrame(() => document.querySelector(`[data-view-checklist-id="${item.id}"]`)?.focus());
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
          {isEmptyTask && (
            <div className="task-content-switch" role="group" aria-label="Тип описания">
              <button type="button" className={contentMode === 'description' ? 'active' : ''} onClick={() => setContentMode('description')}>Описание</button>
              <button type="button" className={contentMode === 'checklist' ? 'active' : ''} onClick={() => setContentMode('checklist')}>To-do list</button>
            </div>
          )}
          {contentMode === 'checklist' ? (
            isEmptyTask ? (
              <div className="checklist-editor mt-2">
                {checklist.map(item => (
                  <div className={`checklist-editor-item${item.done ? ' done' : ''}`} key={item.id}>
                    <button type="button" className="checklist-box" aria-label="Отметить пункт" onClick={() => updateChecklistItem(item.id, { done: !item.done })}>{item.done && '✓'}</button>
                    <textarea data-view-checklist-id={item.id} rows={1} value={item.text} placeholder="Новый пункт" onChange={event => updateChecklistItem(item.id, { text: event.target.value })} onKeyDown={event => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        addChecklistItem(item.id);
                      }
                    }} />
                    <button type="button" className="checklist-remove" aria-label="Удалить пункт" onClick={() => setChecklist(items => items.filter(candidate => candidate.id !== item.id))}>×</button>
                  </div>
                ))}
                <button type="button" className="checklist-add" onClick={() => addChecklistItem()}>+ Добавить пункт</button>
              </div>
            ) : (
            <div className="checklist-view">
              {checklist.length ? checklist.map(item => (
                <button type="button" className={`checklist-view-item${item.done ? ' done' : ''}`} key={item.id} onClick={() => toggleChecklistItem(item.id)}>
                  <span className="checklist-box">{item.done && '✓'}</span>
                  <span>{item.text}</span>
                </button>
              )) : <div className="checklist-empty">Список пока пуст</div>}
            </div>
            )
          ) : (
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
          )}
        </div>
        {(contentMode !== 'checklist' || isEmptyTask) && (
          <div className="popup-footer">
            <button className="btn btn-primary w-100" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

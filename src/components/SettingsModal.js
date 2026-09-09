"use client";

import { useState } from 'react';

export default function SettingsModal({ isOpen, onClose, contentWidth, setContentWidth, calendarWidth, setCalendarWidth }) {
  if (!isOpen) return null;

  return (
    <div className={`modal-overlay ${isOpen ? '' : 'hidden'}`} onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Настройки</h2>
        <div className="settings-scroll-area">
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label>Ширина интерфейса ({contentWidth}px)</label>
            <div style={{ padding: '12px 16px', background: 'var(--surface-light)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input 
                type="range" 
                min="320" 
                max="2000" 
                value={contentWidth} 
                onChange={(e) => setContentWidth(Number(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span>Узкий</span>
                <span>На весь экран</span>
              </div>
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label>Ширина календаря ({calendarWidth}px)</label>
            <div style={{ padding: '12px 16px', background: 'var(--surface-light)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input 
                type="range" 
                min="300" 
                max="1000" 
                value={calendarWidth} 
                onChange={(e) => setCalendarWidth(Number(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span>Узкий</span>
                <span>Широкий</span>
              </div>
            </div>
          </div>
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
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}

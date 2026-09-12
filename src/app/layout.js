"use client";

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import "./globals.css";
import TaskModal from '@/components/TaskModal';
import SettingsModal from '@/components/SettingsModal';
import { useState, useEffect } from 'react';

export default function RootLayout({ children }) {
  const pathname = usePathname();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  useEffect(() => {
    const handleOpenModal = (e) => {
      setTaskToEdit(e.detail || null);
      setIsTaskModalOpen(true);
    };
    window.addEventListener('openTaskModal', handleOpenModal);
    return () => window.removeEventListener('openTaskModal', handleOpenModal);
  }, []);

  return (
    <html lang="ru">
      <body>
        <div
          className="app-container"
          style={{ '--content-max-width': '100%', '--calendar-max-width': '500px' }}
        >
          <header>
            <div style={{ maxWidth: 'var(--content-max-width)', margin: '0 auto', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="tabs">
                <Link href="/" style={{ textDecoration: 'none' }}>
                  <button className={`tab-btn ${pathname === '/' ? 'active' : ''}`}>Мои задачи</button>
                </Link>
                <Link href="/calendar" style={{ textDecoration: 'none' }}>
                  <button className={`tab-btn ${pathname === '/calendar' ? 'active' : ''}`}>Календарь</button>
                </Link>
              </div>
              <button className="icon-btn" aria-label="Настройки" onClick={() => setIsSettingsModalOpen(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </button>
            </div>
          </header>

          <main id="mainContainer" style={{ overflow: pathname === '/calendar' ? 'hidden' : 'auto' }}>
            {children}
          </main>

          <button
            className="fab"
            aria-label="Добавить событие"
            onClick={() => window.dispatchEvent(new CustomEvent('openTaskModal'))}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>

          {isTaskModalOpen && (
            <TaskModal
              isOpen={isTaskModalOpen}
              onClose={() => { setIsTaskModalOpen(false); setTaskToEdit(null); }}
              editTask={taskToEdit}
            />
          )}

          <SettingsModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
          />
        </div>
      </body>
    </html>
  );
}

"use client";

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import "./globals.css";
import TaskModal from '@/components/TaskModal';
import { useState } from 'react';

export default function RootLayout({ children }) {
  const pathname = usePathname();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  return (
    <html lang="ru">
      <body>
        {/* We restrict max width on desktop to simulate the phone feel */}
        <div style={{ maxWidth: '600px', margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 0 20px rgba(0,0,0,0.5)', backgroundColor: 'var(--bg-color)' }}>
          <header>
            <div className="tabs">
              <Link href="/">
                <button className={`tab-btn ${pathname === '/' ? 'active' : ''}`}>Мои задачи</button>
              </Link>
              <Link href="/calendar">
                <button className={`tab-btn ${pathname === '/calendar' ? 'active' : ''}`}>Календарь</button>
              </Link>
            </div>
            <button className="icon-btn" aria-label="Настройки">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </button>
          </header>

          <main id="mainContainer">
            {children}
          </main>

          <button className="fab" aria-label="Добавить событие" onClick={() => setIsTaskModalOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          
          <TaskModal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} />
        </div>
      </body>
    </html>
  );
}

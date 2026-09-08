"use client";

import GlassCard from '@/components/GlassCard';
import styles from './page.module.css';

export default function CalendarPage() {
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  // Fake calendar generation (e.g. for September 2026)
  const daysInMonth = 30;
  const firstDayIndex = 1; // Tuesday
  const days = [];
  
  // Previous month padding
  for (let i = 0; i < firstDayIndex; i++) {
    days.push({ day: 31 - firstDayIndex + i + 1, isOtherMonth: true, hasTask: false });
  }
  
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    // Randomly assign tasks to some days
    const hasTask = [4, 8, 12, 15, 22, 28].includes(i);
    const isToday = i === 8;
    days.push({ day: i, isOtherMonth: false, hasTask, isToday });
  }

  // Next month padding to fill the grid (42 cells total)
  const remainingCells = 42 - days.length;
  for (let i = 1; i <= remainingCells; i++) {
    days.push({ day: i, isOtherMonth: true, hasTask: false });
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Calendar</h1>
        <div className={styles.monthNav}>
          <button className={styles.navBtn}>&lt;</button>
          <span>September 2026</span>
          <button className={styles.navBtn}>&gt;</button>
        </div>
      </div>

      <GlassCard>
        <div className={styles.calendarGrid}>
          {weekdays.map(day => (
            <div key={day} className={styles.weekday}>{day}</div>
          ))}
          
          {days.map((d, i) => (
            <div 
              key={i} 
              className={`
                ${styles.day} 
                ${d.isOtherMonth ? styles.otherMonth : ''} 
                ${d.isToday ? styles.today : ''}
              `}
            >
              <div className={styles.dayNumber}>{d.day}</div>
              {d.hasTask && <div className={styles.taskIndicator}></div>}
            </div>
          ))}
        </div>
      </GlassCard>
      
      <div style={{ marginTop: '24px', color: 'var(--text-secondary)' }}>
        <p>💡 <b>Note:</b> Cloud synchronization with your mobile app is currently not configured.</p>
        <p>This is a mockup calendar. Once Firebase is linked, your real tasks will appear here.</p>
      </div>
    </div>
  );
}

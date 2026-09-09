"use client";

import GlassCard from '@/components/GlassCard';
import styles from './page.module.css';
import { useState } from 'react';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 8, 1)); // Start at Sep 2026 to match initial mockup
  
  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  let firstDayIndex = new Date(year, month, 1).getDay() - 1;
  if (firstDayIndex === -1) firstDayIndex = 6; // Sunday becomes 6
  
  const days = [];
  
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  for (let i = 0; i < firstDayIndex; i++) {
    days.push({ day: daysInPrevMonth - firstDayIndex + i + 1, isOtherMonth: true, hasTask: false });
  }
  
  const today = new Date();
  for (let i = 1; i <= daysInMonth; i++) {
    const hasTask = [4, 8, 12, 15, 22, 28].includes(i);
    const isToday = today.getDate() === i && today.getMonth() === month && today.getFullYear() === year;
    days.push({ day: i, isOtherMonth: false, hasTask, isToday });
  }

  const remainingCells = 42 - days.length;
  for (let i = 1; i <= remainingCells; i++) {
    days.push({ day: i, isOtherMonth: true, hasTask: false });
  }
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Calendar</h1>
        <div className={styles.monthNav}>
          <button className={styles.navBtn} onClick={() => changeMonth(-1)}>&lt;</button>
          <span>{monthNames[month]} {year}</span>
          <button className={styles.navBtn} onClick={() => changeMonth(1)}>&gt;</button>
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

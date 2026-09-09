"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "tasks"), (snapshot) => {
      const tasksData = [];
      snapshot.forEach((doc) => {
        tasksData.push({ ...doc.data(), id: String(doc.id) });
      });
      setTasks(tasksData);
    });
    return () => unsubscribe();
  }, []);

  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  let firstDayIndex = new Date(year, month, 1).getDay() - 1;
  if (firstDayIndex === -1) firstDayIndex = 6;
  
  const days = [];
  
  // Empty slots for previous month
  for (let i = 0; i < firstDayIndex; i++) {
    days.push({ empty: true });
  }
  
  const today = new Date();
  for (let i = 1; i <= daysInMonth; i++) {
    const isToday = today.getDate() === i && today.getMonth() === month && today.getFullYear() === year;
    const isSelected = selectedDate.getDate() === i && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
    
    // Check if there are tasks on this day
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const hasTask = tasks.some(t => t.dueDate === dateString || (t.dueDate && t.dueDate.startsWith(dateString)));
    
    days.push({ 
      day: i, 
      empty: false, 
      isToday, 
      isSelected, 
      hasTask,
      fullDate: new Date(year, month, i)
    });
  }

  const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

  const selectedDateString = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
  const selectedTasks = tasks.filter(t => t.dueDate === selectedDateString || (t.dueDate && t.dueDate.startsWith(selectedDateString)));

  return (
    <div className="view-container active" style={{ padding: '0 20px 20px' }}>
      <div className="calendar-wrapper" style={{ width: '100%', maxWidth: 'var(--calendar-max-width, 400px)', margin: '0 auto' }}>
        <div className="calendar-header">
          <button className="icon-btn" onClick={() => changeMonth(-1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <h2>{monthNames[month]} {year}</h2>
          <button className="icon-btn" onClick={() => changeMonth(1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
        <div className="calendar-grid">
          <div className="weekdays-grid">
            {weekdays.map(day => <div key={day} className="weekday">{day}</div>)}
          </div>
          <div className="days-grid">
            {days.map((d, i) => (
              d.empty ? (
                <div key={i} className="calendar-day empty"></div>
              ) : (
                <div 
                  key={i} 
                  className={`calendar-day ${d.isToday ? 'today' : ''} ${d.isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedDate(d.fullDate)}
                >
                  {d.day}
                  {d.hasTask && (
                    <div className="task-dots">
                      <div className="task-dot"></div>
                    </div>
                  )}
                </div>
              )
            ))}
          </div>
        </div>
      </div>
      
      <div className="calendar-tasks-list" style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '12px', color: 'var(--text-muted)' }}>
          {selectedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
        </h3>
        
        {selectedTasks.length === 0 ? (
           <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Нет задач на этот день</div>
        ) : (
          selectedTasks.map(task => (
            <div key={task.id} className={`task-item ${task.done ? 'done' : ''}`} style={{ marginBottom: '12px' }}>
              <div className="task-content" style={{ marginLeft: '12px' }}>
                <div className="task-title">{task.title}</div>
                <div className="task-badges">
                  <span className="badge time-badge">
                    {task.isAllDay ? 'Весь день' : (task.dueTime || '09:00')}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

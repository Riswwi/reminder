"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortMethod, setSortMethod] = useState('time'); // 'time' or 'priority'

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "tasks"), (snapshot) => {
      const tasksData = [];
      snapshot.forEach((doc) => {
        tasksData.push({ ...doc.data(), id: String(doc.id) });
      });
      setTasks(tasksData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleTask = async (id, currentStatus) => {
    try {
      await updateDoc(doc(db, "tasks", id), {
        done: !currentStatus
      });
    } catch (e) {
      console.error(e);
    }
  };

  const deleteTask = async (id) => {
    try {
      await deleteDoc(doc(db, "tasks", id));
    } catch (error) {
      console.error("Error deleting task: ", error);
    }
  };

  const activeTasks = tasks.filter(t => !t.done);
  const completedTasks = tasks.filter(t => t.done);
  
  if (sortMethod === 'priority') {
    activeTasks.sort((a, b) => (b.priority || 1) - (a.priority || 1));
  }

  // Simplified: just render all active tasks, and then a completed section
  return (
    <div className="view-container active" style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column' }}>
      <div className="sort-controls">
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Сортировка:</span>
        <div className="sort-toggle">
          <button 
            className={`sort-btn ${sortMethod === 'time' ? 'active' : ''}`}
            onClick={() => setSortMethod('time')}
          >
            По времени
          </button>
          <button 
            className={`sort-btn ${sortMethod === 'priority' ? 'active' : ''}`}
            onClick={() => setSortMethod('priority')}
          >
            По приоритету
          </button>
        </div>
      </div>

      <div className="task-list-container">
        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Загрузка...</div>
        ) : activeTasks.length === 0 && completedTasks.length === 0 ? (
           <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>У вас нет задач. Нажмите + чтобы создать.</div>
        ) : (
          <>
            {activeTasks.map(task => (
              <div key={task.id} className="task-item">
                <div className="checkbox" onClick={() => toggleTask(task.id, task.done)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <div className="task-content">
                  <div className="task-title">{task.title}</div>
                  {task.desc && <div className="task-desc">{task.desc}</div>}
                  <div className="task-badges">
                    <span className="badge time-badge">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                      {task.isAllDay ? 'Весь день' : (task.dueTime || '09:00')}
                    </span>
                    {task.priority && task.priority > 1 && (
                      <span className="badge" style={{ color: task.priority === 3 ? '#FF453A' : '#FFD60A' }}>
                        {task.priority === 3 ? 'Срочно' : 'В скором времени'}
                      </span>
                    )}
                  </div>
                </div>
                <button className="delete-btn" onClick={() => deleteTask(task.id)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            ))}

            {completedTasks.length > 0 && (
              <div className="completed-section">
                <div className="completed-header">
                  <div className="completed-header-chevron open">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </div>
                  <div className="completed-header-text">Завершенные</div>
                  <div className="completed-header-count">{completedTasks.length}</div>
                </div>
                <div className="completed-tasks-list">
                  {completedTasks.map(task => (
                    <div key={task.id} className="task-item done">
                      <div className="checkbox" onClick={() => toggleTask(task.id, task.done)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </div>
                      <div className="task-content">
                        <div className="task-title">{task.title}</div>
                        <div className="task-badges">
                          <span className="badge time-badge">
                            {task.isAllDay ? 'Весь день' : (task.dueTime || '09:00')}
                          </span>
                        </div>
                      </div>
                      <button className="delete-btn" onClick={() => deleteTask(task.id)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

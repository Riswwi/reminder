"use client";

import GlassCard from '@/components/GlassCard';
import styles from './page.module.css';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "tasks"), (snapshot) => {
      const tasksData = [];
      snapshot.forEach((doc) => {
        tasksData.push({ id: doc.id, ...doc.data() });
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

  const addNewTask = async () => {
    try {
      const newId = Date.now();
      const taskRef = doc(db, "tasks", String(newId));
      await setDoc(taskRef, {
        id: newId,
        title: "New Task from Dashboard",
        dueDate: new Date().toISOString().split('T')[0],
        time: "12:00",
        done: false,
        category: "General"
      });
    } catch (e) {
      console.error("Error adding task: ", e);
    }
  };

  const completedCount = tasks.filter(t => t.done).length;
  const totalCount = tasks.length;
  const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  
  // Show only up to 5 tasks today for dashboard
  const todayTasks = tasks.slice(0, 5);

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Welcome back, <span className="text-gradient">Pro User</span></h1>
          <p className={styles.subtitle}>Here is what's happening with your tasks today.</p>
        </div>
        <button style={{
          background: 'var(--accent-gradient)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '12px',
          fontWeight: '600',
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
          transition: 'transform 0.2s ease',
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        onClick={addNewTask}
        >
          + New Task
        </button>
      </div>

      <div className={styles.grid}>
        <GlassCard>
          <div className={styles.statLabel}>Today's Progress</div>
          <div className={styles.statValue}>{progress}%</div>
          <div style={{ background: 'rgba(255,255,255,0.1)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ 
              background: 'var(--accent-gradient)', 
              height: '100%', 
              width: `${progress}%`,
              transition: 'width 1s ease-in-out'
            }}></div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className={styles.statLabel}>Upcoming Reminders</div>
          <div className={styles.statValue}>{totalCount - completedCount}</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Tasks left for today</p>
        </GlassCard>

        <GlassCard>
          <div className={styles.statLabel}>Sync Status</div>
          <div className={styles.statValue} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: 'var(--success)' }}>●</span>
            <span style={{ fontSize: '32px' }}>Active</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Firebase Connected</p>
        </GlassCard>
      </div>

      <div className={styles.recentTasks}>
        <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>Today's Tasks</h2>
        <GlassCard style={{ padding: '8px' }}>
          {loading ? (
             <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</div>
          ) : todayTasks.length === 0 ? (
             <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No tasks for today!</div>
          ) : todayTasks.map(task => (
            <div key={task.id} className={styles.taskItem}>
              <div className={styles.taskInfo}>
                <div 
                  className={styles.taskCheckbox}
                  onClick={() => toggleTask(task.id, task.done)}
                  style={task.done ? { background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' } : {}}
                >
                  {task.done && <span style={{ color: '#fff', fontSize: '14px' }}>✓</span>}
                </div>
                <span className={styles.taskTitle} style={task.done ? { textDecoration: 'line-through', color: 'var(--text-secondary)' } : {}}>
                  {task.title}
                </span>
              </div>
              <div className={styles.taskTime}>{task.time || task.dueDate}</div>
            </div>
          ))}
        </GlassCard>
      </div>
    </div>
  );
}

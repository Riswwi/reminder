"use client";

import GlassCard from '@/components/GlassCard';
import styles from './page.module.css';
import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [tasks, setTasks] = useState([
    { id: 1, title: 'Review PRs for web interface', time: '10:00 AM', completed: false },
    { id: 2, title: 'Sync mobile app data', time: '14:30 PM', completed: true },
    { id: 3, title: 'Update documentation', time: '16:00 PM', completed: false },
  ]);

  const toggleTask = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

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
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Last synced 2 mins ago</p>
        </GlassCard>
      </div>

      <div className={styles.recentTasks}>
        <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>Today's Tasks</h2>
        <GlassCard style={{ padding: '8px' }}>
          {tasks.map(task => (
            <div key={task.id} className={styles.taskItem}>
              <div className={styles.taskInfo}>
                <div 
                  className={styles.taskCheckbox}
                  onClick={() => toggleTask(task.id)}
                  style={task.completed ? { background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' } : {}}
                >
                  {task.completed && <span style={{ color: '#fff', fontSize: '14px' }}>✓</span>}
                </div>
                <span className={styles.taskTitle} style={task.completed ? { textDecoration: 'line-through', color: 'var(--text-secondary)' } : {}}>
                  {task.title}
                </span>
              </div>
              <div className={styles.taskTime}>{task.time}</div>
            </div>
          ))}
        </GlassCard>
      </div>
    </div>
  );
}

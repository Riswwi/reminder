"use client";

import GlassCard from '@/components/GlassCard';
import styles from './page.module.css';
import { useState } from 'react';

export default function TasksPage() {
  const [tasks, setTasks] = useState([
    { id: 1, title: 'Review PRs for web interface', category: 'Work', time: '10:00 AM', completed: false },
    { id: 2, title: 'Sync mobile app data', category: 'App', time: '14:30 PM', completed: true },
    { id: 3, title: 'Update documentation', category: 'Work', time: '16:00 PM', completed: false },
    { id: 4, title: 'Buy groceries', category: 'Personal', time: '18:00 PM', completed: false },
    { id: 5, title: 'Workout', category: 'Health', time: '20:00 PM', completed: false },
  ]);

  const [activeTab, setActiveTab] = useState('All');

  const toggleTask = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const filteredTasks = activeTab === 'All' 
    ? tasks 
    : tasks.filter(t => t.category === activeTab);

  const categories = ['All', 'Work', 'App', 'Personal', 'Health'];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>All Tasks</h1>
        <div className={styles.actions}>
          <button className={styles.primaryBtn}>+ Add Task</button>
        </div>
      </div>

      <div className={styles.tabs}>
        {categories.map(cat => (
          <button 
            key={cat} 
            className={`${styles.tab} ${activeTab === cat ? styles.activeTab : ''}`}
            onClick={() => setActiveTab(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <GlassCard className={styles.listCard}>
        {filteredTasks.length === 0 ? (
          <div className={styles.emptyState}>No tasks found in this category.</div>
        ) : (
          <div className={styles.taskList}>
            {filteredTasks.map(task => (
              <div key={task.id} className={styles.taskItem}>
                <div className={styles.taskLeft}>
                  <div 
                    className={styles.checkbox}
                    onClick={() => toggleTask(task.id)}
                    style={task.completed ? { background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' } : {}}
                  >
                    {task.completed && <span style={{ color: '#fff', fontSize: '14px' }}>✓</span>}
                  </div>
                  <div>
                    <div className={styles.taskTitle} style={task.completed ? { textDecoration: 'line-through', color: 'var(--text-secondary)' } : {}}>
                      {task.title}
                    </div>
                    <div className={styles.taskCategory}>{task.category}</div>
                  </div>
                </div>
                <div className={styles.taskRight}>
                  <div className={styles.taskTime}>{task.time}</div>
                  <button className={styles.moreBtn}>⋮</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

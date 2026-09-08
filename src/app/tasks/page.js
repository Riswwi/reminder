"use client";

import GlassCard from '@/components/GlassCard';
import styles from './page.module.css';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, query, orderBy, setDoc } from 'firebase/firestore';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "tasks"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksData = [];
      snapshot.forEach((doc) => {
        tasksData.push({ id: doc.id, ...doc.data() });
      });
      // Sort tasks by time locally or assume they have some order
      setTasks(tasksData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching tasks: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleTask = async (id, currentStatus) => {
    try {
      const taskRef = doc(db, "tasks", id);
      await updateDoc(taskRef, {
        done: !currentStatus
      });
    } catch (error) {
      console.error("Error updating task: ", error);
    }
  };

  const addNewTask = async () => {
    try {
      const newId = Date.now();
      const taskRef = doc(db, "tasks", String(newId));
      await setDoc(taskRef, {
        id: newId,
        title: "New Task from Web",
        dueDate: new Date().toISOString().split('T')[0],
        time: "12:00",
        done: false,
        category: "Work"
      });
    } catch (e) {
      console.error("Error adding task: ", e);
    }
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
          <button className={styles.primaryBtn} onClick={addNewTask}>+ Add Task</button>
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
        {loading ? (
          <div className={styles.emptyState}>Loading tasks from Firebase...</div>
        ) : filteredTasks.length === 0 ? (
          <div className={styles.emptyState}>No tasks found in this category.</div>
        ) : (
          <div className={styles.taskList}>
            {filteredTasks.map(task => (
              <div key={task.id} className={styles.taskItem}>
                <div className={styles.taskLeft}>
                  <div 
                    className={styles.checkbox}
                    onClick={() => toggleTask(task.id, task.done)}
                    style={task.done ? { background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' } : {}}
                  >
                    {task.done && <span style={{ color: '#fff', fontSize: '14px' }}>✓</span>}
                  </div>
                  <div>
                    <div className={styles.taskTitle} style={task.done ? { textDecoration: 'line-through', color: 'var(--text-secondary)' } : {}}>
                      {task.title}
                    </div>
                    <div className={styles.taskCategory}>{task.category || 'General'}</div>
                  </div>
                </div>
                <div className={styles.taskRight}>
                  <div className={styles.taskTime}>{task.time || task.dueDate}</div>
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

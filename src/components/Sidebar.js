"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: '📊' },
    { name: 'Tasks', path: '/tasks', icon: '✅' },
    { name: 'Calendar', path: '/calendar', icon: '📅' },
    { name: 'Settings', path: '/settings', icon: '⚙️' },
  ];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>⚡</div>
        <span className="text-gradient">SyncApp</span>
      </div>

      <nav className={styles.nav}>
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link 
              key={item.name} 
              href={item.path}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            >
              <span>{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.userProfile}>
        <div className={styles.avatar}></div>
        <div className={styles.userInfo}>
          <span className={styles.userName}>Pro User</span>
          <span className={styles.userEmail}>user@example.com</span>
        </div>
      </div>
    </aside>
  );
}

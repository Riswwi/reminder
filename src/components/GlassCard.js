import styles from './GlassCard.module.css';

export default function GlassCard({ children, className = '', style = {} }) {
  return (
    <div className={`${styles.card} ${className}`} style={style}>
      {children}
    </div>
  );
}

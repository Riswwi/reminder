"use client";

import { useEffect, useState } from 'react';
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const authErrorMessage = (error) => {
  switch (error?.code) {
    case 'auth/invalid-email': return 'Проверьте адрес электронной почты.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'Неверный e-mail или пароль.';
    case 'auth/too-many-requests': return 'Слишком много попыток. Попробуйте позже.';
    case 'auth/network-request-failed': return 'Нет связи с Firebase. Проверьте интернет.';
    case 'auth/operation-not-allowed': return 'В Firebase нужно включить вход по e-mail и паролю.';
    default: return `Не удалось войти (${error?.code || 'неизвестная ошибка'}).`;
  }
};

export default function AuthGate({ children }) {
  const [user, setUser] = useState(undefined);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => onAuthStateChanged(auth, setUser, (authError) => {
    setError(authErrorMessage(authError));
    setUser(null);
  }), []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword('');
    } catch (authError) {
      setError(authErrorMessage(authError));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!email.trim()) {
      setError('Сначала введите e-mail.');
      return;
    }
    setError('');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setNotice('Если этот адрес зарегистрирован, письмо для сброса пароля отправлено.');
    } catch (authError) {
      setError(authErrorMessage(authError));
    }
  };

  if (user) return children;

  return (
    <div className="auth-screen">
      {user === undefined ? (
        <p role="status">Проверяем вход…</p>
      ) : (
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1>Войти в задачи</h1>
          <p>Войдите один раз. Сайт запомнит вход на этом устройстве.</p>
          <label htmlFor="authEmail">E-mail</label>
          <input id="authEmail" type="email" autoComplete="username" value={email}
            onChange={(event) => setEmail(event.target.value)} required />
          <label htmlFor="authPassword">Пароль</label>
          <input id="authPassword" type="password" autoComplete="current-password" value={password}
            onChange={(event) => setPassword(event.target.value)} required />
          {error && <p className="auth-error" role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}
          <button type="submit" disabled={busy}>{busy ? 'Входим…' : 'Войти'}</button>
          <button className="auth-reset" type="button" onClick={resetPassword}>Забыли пароль?</button>
        </form>
      )}
    </div>
  );
}

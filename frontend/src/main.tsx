import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './assets/styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Не найден контейнер #root');

async function start() {
  // Демо-режим: встроенный в браузер бэкенд с реалистичными данными (npm run demo). Docker не нужен.
  if (import.meta.env.VITE_MOCK === '1') {
    const { installMock } = await import('./mock');
    await installMock();
  }
  createRoot(root!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
void start();

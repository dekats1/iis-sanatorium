import { defineConfig } from '@playwright/test';

/**
 * Сквозные тесты идут против запущенной системы (docker compose up) через nginx фронтенда.
 * Предусловия: профиль core-service demo (демо-пользователи), загружены тарифы и история спроса pricing-forecast
 * (см. README, раздел «Первый запуск»). Адрес: E2E_BASE_URL (по умолчанию http://localhost:3000).
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 0,
  workers: 1, // тесты меняют общее состояние (места, путёвки) — параллельность дала бы случайные конфликты
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    locale: 'ru-RU',
    trace: 'retain-on-failure',
  },
});

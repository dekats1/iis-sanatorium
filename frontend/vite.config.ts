import react from '@vitejs/plugin-react';
import { defineConfig, type ProxyOptions } from 'vite';

const GATEWAY = 'http://localhost:8080';

// В разработке запросы /api и /pricing уходят на шлюз. Для браузера это тот же origin (страница и /api на одном порту),
// а шлюз с «чужим» Origin (например, localhost:5174 вместо разрешённого 5173) отвечает 403 «Invalid CORS request».
// Поэтому прокси подставляет Origin самого шлюза: для шлюза запрос становится не кросс-доменным.
const proxy: ProxyOptions = {
  target: GATEWAY,
  changeOrigin: true,
  headers: { Origin: GATEWAY },
};

// Ключи со слешем на конце: страница SPA /pricing (тарифы) не должна уходить на шлюз — только /pricing/... API.
// В демо-режиме (--mode demo) запросы обслуживает встроенный мок, прокси не нужен.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // не уходить молча на 5174 при занятом порте: адрес должен быть предсказуемым
    proxy: mode === 'demo' ? undefined : { '/api/': proxy, '/pricing/': proxy },
  },
}));

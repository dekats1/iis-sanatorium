import { expect, type APIRequestContext, type Page } from '@playwright/test';

/** Демо-пользователи core-service (профиль demo). Пароль задаётся CORE_DEMO_PASSWORD, по умолчанию demo12345. */
const PASSWORD = process.env.E2E_DEMO_PASSWORD ?? 'demo12345';

export const USERS = {
  client: { username: 'client', password: PASSWORD },
  admin: { username: 'admin', password: PASSWORD },
  doctor: { username: 'doctor', password: PASSWORD },
  manager: { username: 'manager', password: PASSWORD },
  sysadmin: { username: 'sysadmin', password: PASSWORD },
} as const;

export type DemoUser = (typeof USERS)[keyof typeof USERS];

export async function loginViaUi(page: Page, user: DemoUser): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Логин').fill(user.username);
  await page.getByLabel('Пароль').fill(user.password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();
}

export async function apiToken(request: APIRequestContext, user: DemoUser): Promise<string> {
  const response = await request.post('/api/auth/login', { data: user });
  expect(response.ok(), 'вход демо-пользователя через API').toBeTruthy();
  return ((await response.json()) as { token: string }).token;
}

/** Дата в формате ISO со сдвигом в сутках от сегодняшней. */
export function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

import { expect, test } from '@playwright/test';
import { loginViaUi, USERS } from '../fixtures/test-data';

// СЦ-1: бронирование с динамической ценой (ФТ-05…ФТ-08).
test('клиент находит номер, оформляет путёвку и получает ссылку на оплату', async ({ page }) => {
  await loginViaUi(page, USERS.client);

  await expect(page.getByRole('heading', { name: 'Поиск свободных номеров' })).toBeVisible();
  await page.getByRole('button', { name: 'Найти' }).click();

  const choose = page.getByRole('button', { name: 'Выбрать' }).first();
  await expect(choose, 'есть хотя бы одна категория со свободными местами и ценой').toBeVisible();
  await choose.click();

  await expect(page.getByRole('heading', { name: 'Оформление путёвки' })).toBeVisible();
  await page.getByRole('button', { name: 'Забронировать' }).click();

  await expect(page.getByRole('heading', { name: /Путёвка №/ })).toBeVisible();
  await expect(page.getByText('Ожидает оплаты')).toBeVisible();

  await page.getByRole('button', { name: 'Перейти к оплате' }).click();
  await expect(page.getByRole('link', { name: 'Открыть страницу оплаты' })).toBeVisible();

  // путёвка появилась в личном кабинете
  await page.getByRole('link', { name: 'Мои путёвки' }).click();
  await expect(page.getByRole('table', { name: /Путёвки клиента/ }).getByRole('row').nth(1)).toBeVisible();
});

test('неверный пароль не пускает в систему и показывает сообщение', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Логин').fill('client');
  await page.getByLabel('Пароль').fill('wrong-password');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Выйти' })).toHaveCount(0);
});

test('клиенту недоступны разделы других ролей', async ({ page }) => {
  await loginViaUi(page, USERS.client);
  await page.goto('/manager');
  await expect(page.getByText('Раздел недоступен для вашей роли.')).toBeVisible();
});

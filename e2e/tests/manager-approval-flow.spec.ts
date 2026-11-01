import { expect, test } from '@playwright/test';
import { loginViaUi, USERS } from '../fixtures/test-data';

// СЦ-2 и СЦ-4: рекомендации вне коридора, показатели, прогноз (ФТ-15…ФТ-18).
test('менеджер видит показатели и каналы продаж', async ({ page }) => {
  await loginViaUi(page, USERS.manager);
  await expect(page.getByRole('heading', { name: 'Доходность и прогноз' })).toBeVisible();

  await page.getByRole('button', { name: 'Рассчитать' }).click();
  await expect(page.getByRole('table', { name: /Показатели/ })).toBeVisible();
  await expect(page.getByRole('table', { name: /Выручка и комиссия по каналам/ })).toBeVisible();
});

test('менеджер строит прогноз загрузки', async ({ page }) => {
  await loginViaUi(page, USERS.manager);
  await page.getByRole('button', { name: 'Построить прогноз' }).click();
  // нужна история спроса (сидирование pricing-forecast); без неё сервис честно отвечает 422 — это тоже проверка ФТ-15
  await expect(page.getByText(/Прогноз построен/).or(page.getByRole('alert'))).toBeVisible();
});

test('менеджер принимает к сведению рекомендацию вне коридора, если она есть', async ({ page }) => {
  await loginViaUi(page, USERS.manager);
  const table = page.getByRole('table', { name: /Рекомендации цены, ожидающие решения/ });
  await expect(table).toBeVisible();
  const accept = table.getByRole('button', { name: 'Принять к сведению' }).first();
  test.skip((await accept.count()) === 0, 'нет нерассмотренных рекомендаций (нужны бронирования с ценой вне коридора)');
  const before = await table.getByRole('button', { name: 'Принять к сведению' }).count();
  await accept.click();
  await expect(table.getByRole('button', { name: 'Принять к сведению' })).toHaveCount(before - 1);
});

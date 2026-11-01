import { expect, test } from '@playwright/test';
import { apiToken, isoDate, loginViaUi, USERS } from '../fixtures/test-data';

// СЦ-3: назначение лечения и расписание (ФТ-12…ФТ-14). Путёвку создаёт клиент через API — это предусловие сценария.
test('врач назначает процедуры по путёвке и составляет расписание', async ({ page, request }) => {
  const clientToken = await apiToken(request, USERS.client);
  const headers = { Authorization: `Bearer ${clientToken}` };

  const from = isoDate(30);
  const to = isoDate(37);
  const availability = await request.get(`/api/availability?from=${from}&to=${to}&places=1`, { headers });
  expect(availability.ok()).toBeTruthy();
  const categories = (await availability.json()) as { categoryId: number; freePlaces: number; priceAvailable: boolean }[];
  const category = categories.find((c) => c.freePlaces > 0 && c.priceAvailable);
  test.skip(!category, 'нет свободных номеров с ценой на выбранные даты');

  const [profiles, channels] = await Promise.all([
    request.get('/api/directory/treatment-profiles', { headers }).then((r) => r.json() as Promise<{ id: number }[]>),
    request.get('/api/directory/sales-channels', { headers }).then((r) => r.json() as Promise<{ id: number }[]>),
  ]);
  const created = await request.post('/api/vouchers', {
    headers,
    data: { categoryId: category?.categoryId, checkIn: from, checkOut: to, places: 1, profileId: profiles[0]?.id, channelId: channels[0]?.id },
  });
  expect(created.ok(), 'путёвка создана').toBeTruthy();
  const voucher = (await created.json()) as { id: number };

  await loginViaUi(page, USERS.doctor);
  await page.getByLabel('Номер путёвки').fill(String(voucher.id));
  await page.getByRole('button', { name: 'Показать назначения' }).click();

  await expect(page.getByRole('heading', { name: 'Новое назначение' })).toBeVisible();
  await page.getByRole('button', { name: 'Назначить', exact: true }).click();

  // либо назначение создано, либо система предупредила о противопоказаниях — оба исхода допустимы по ФТ-13
  const created$ = page.getByText(/Назначение № \d+ создано/);
  const warning$ = page.getByText('Обнаружены противопоказания:');
  await expect(created$.or(warning$)).toBeVisible();
  if (await warning$.isVisible()) {
    await page.getByRole('button', { name: /несмотря на противопоказания/ }).click();
    await expect(created$).toBeVisible();
  }

  await page.getByRole('button', { name: 'Составить расписание' }).first().click();
  await expect(page.getByRole('table', { name: /Расписание сеансов назначения/ })).toBeVisible();
});

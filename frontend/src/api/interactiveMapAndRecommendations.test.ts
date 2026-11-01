import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATEGORY_MEDIA, interactiveRoomsApi, smartRecommendationsApi } from './interactiveMapAndRecommendations';

function respond(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Interactive Room Map & Smart Recommendations Services (Java Spring Boot Integration)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  const mockRooms = [
    { id: 101, roomNumber: '101', categoryId: 1, floor: 1, status: 'VACANT' },
    { id: 102, roomNumber: '102', categoryId: 1, floor: 1, status: 'OCCUPIED', currentGuestName: 'Иванова Мария Петровна', voucherCode: 'V-2026-089' },
    { id: 105, roomNumber: '105', categoryId: 2, floor: 1, status: 'VACANT' },
    { id: 201, roomNumber: '201', categoryId: 2, floor: 2, status: 'VACANT' },
  ];

  it('loads interactive room list and filters by floor and status from backend', async () => {
    const mockStats = { total: 18, vacant: 12, occupied: 3, cleaning: 2, reserved: 1, occupancyPercent: 16.7 };

    fetchMock
      .mockResolvedValueOnce(respond(200, mockRooms))
      .mockResolvedValueOnce(respond(200, [mockRooms[0], mockRooms[1], mockRooms[2]]))
      .mockResolvedValueOnce(respond(200, [mockRooms[0], mockRooms[2]]))
      .mockResolvedValueOnce(respond(200, mockStats));

    const allRooms = await interactiveRoomsApi.list();
    expect(allRooms.length).toBe(4);

    const floor1Rooms = await interactiveRoomsApi.list({ floor: 1 });
    expect(floor1Rooms.length).toBe(3);

    const vacantRooms = await interactiveRoomsApi.list({ status: 'VACANT' });
    expect(vacantRooms.length).toBe(2);

    const stats = await interactiveRoomsApi.stats();
    expect(stats.total).toBe(18);
    expect(stats.vacant).toBe(12);
  });

  it('updates room status and guest occupancy data', async () => {
    const single105 = { id: 105, roomNumber: '105', categoryId: 2, floor: 1, status: 'VACANT' };
    const updated105 = {
      ...single105,
      status: 'OCCUPIED',
      currentGuestName: 'Тестовый Гость',
      voucherCode: 'V-TEST-001',
      checkInDate: '2026-11-01',
      checkOutDate: '2026-11-10',
    };
    const freed105 = { ...single105, status: 'VACANT', currentGuestName: undefined };

    fetchMock
      .mockResolvedValueOnce(respond(200, single105))
      .mockResolvedValueOnce(respond(200, updated105))
      .mockResolvedValueOnce(respond(200, freed105));

    const room = await interactiveRoomsApi.get(105);
    expect(room?.status).toBe('VACANT');

    const updated = await interactiveRoomsApi.updateStatus(105, 'OCCUPIED', {
      guestName: 'Тестовый Гость',
      voucherCode: 'V-TEST-001',
      checkInDate: '2026-11-01',
      checkOutDate: '2026-11-10',
    });
    expect(updated.status).toBe('OCCUPIED');
    expect(updated.currentGuestName).toBe('Тестовый Гость');

    const freed = await interactiveRoomsApi.updateStatus(105, 'VACANT');
    expect(freed.status).toBe('VACANT');
    expect(freed.currentGuestName).toBeUndefined();
  });

  it('provides health goals and personalized smart recommendations', async () => {
    const goals = smartRecommendationsApi.getGoals();
    expect(goals.length).toBe(5);
    expect(goals[0].id).toBe('CARDIO');

    const recCardio = await smartRecommendationsApi.recommend({ goalId: 'CARDIO' });
    expect(recCardio.profileName).toContain('Кардиологический');
    expect(recCardio.dietName).toContain('Диета №10');
    expect(recCardio.procedures.length).toBeGreaterThan(0);
    expect(recCardio.matchScore).toBeGreaterThanOrEqual(95);

    const recJoints = await smartRecommendationsApi.recommend({
      goalId: 'JOINTS',
      hasMobilityIssue: true,
    });
    expect(recJoints.recommendedFloorNote).toContain('1 этаж');

    const recAntistress = await smartRecommendationsApi.recommend({
      goalId: 'ANTISTRESS',
      allergies: ['хвоя', 'лаванда'],
    });
    expect(recAntistress.contraindicationsAlert.length).toBeGreaterThan(0);
    expect(recAntistress.procedures.some((p) => p.name.includes('хвойн'))).toBe(false);
  });

  it('guarantees guest privacy and 152-ФЗ confidentiality for client requests', async () => {
    const clientRooms = [
      { id: 101, roomNumber: '101', categoryId: 1, floor: 1, status: 'VACANT' },
      { id: 102, roomNumber: '102', categoryId: 1, floor: 1, status: 'OCCUPIED' },
    ];
    const staffRooms = [
      { id: 101, roomNumber: '101', categoryId: 1, floor: 1, status: 'VACANT' },
      { id: 102, roomNumber: '102', categoryId: 1, floor: 1, status: 'OCCUPIED', currentGuestName: 'Иванова Мария Петровна', voucherCode: 'V-2026-089' },
    ];

    fetchMock
      .mockResolvedValueOnce(respond(200, clientRooms))
      .mockResolvedValueOnce(respond(200, clientRooms[1]))
      .mockResolvedValueOnce(respond(200, staffRooms))
      .mockResolvedValueOnce(respond(200, staffRooms[1]));

    const publicList = await interactiveRoomsApi.list({ isStaff: false });
    expect(publicList[1].currentGuestName).toBeUndefined();

    const publicSingle = await interactiveRoomsApi.get(102, false);
    expect(publicSingle?.currentGuestName).toBeUndefined();

    const staffList = await interactiveRoomsApi.list({ isStaff: true });
    expect(staffList[1].currentGuestName).toBe('Иванова Мария Петровна');

    const staffSingle = await interactiveRoomsApi.get(102, true);
    expect(staffSingle?.currentGuestName).toBe('Иванова Мария Петровна');
  });

  it('provides rich room photos and media galleries for all room categories', async () => {
    expect(Object.keys(CATEGORY_MEDIA).length).toBe(5);
    for (let catId = 1; catId <= 5; catId++) {
      const media = CATEGORY_MEDIA[catId];
      expect(media).toBeDefined();
      // Офлайн-источники: art:<categoryId>:<index>, RoomImage рисует их как SVG без сети
      expect(media.cover).toBe(`art:${catId}:0`);
      expect(media.photos.length).toBeGreaterThanOrEqual(4);
      expect(media.photos.every((p) => p.startsWith(`art:${catId}:`))).toBe(true);
      expect(new Set(media.photos).size).toBe(media.photos.length);
    }

    fetchMock.mockResolvedValueOnce(respond(200, mockRooms));
    const rooms = await interactiveRoomsApi.list();
    expect(rooms.every((r) => Array.isArray(r.photos) && r.photos.length >= 4)).toBe(true);
  });
});

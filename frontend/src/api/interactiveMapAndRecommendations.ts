import { get, put, query } from './client';
import type {
  HealthGoalOption,
  HealthRecommendationResult,
  InteractiveRoom,
  RoomStatus,
} from '../types';
import { packagesApi } from './biAndOperations';

/** Число офлайн-кадров на категорию: спальня, гостиная зона, санузел, вид из окна. */
const PHOTOS_PER_CATEGORY = 4;

/** Офлайн-источник фото `art:<categoryId>:<index>` — RoomImage рисует его как SVG-иллюстрацию без сети. */
export function artPhoto(categoryId: number, index: number): string {
  return `art:${categoryId}:${index}`;
}

function categoryMedia(categoryId: number): { cover: string; photos: string[] } {
  const photos = Array.from({ length: PHOTOS_PER_CATEGORY }, (_, i) => artPhoto(categoryId, i));
  return { cover: photos[0], photos };
}

// Фотофонд категорий номеров санатория (офлайн-иллюстрации: интерьер, мебель, санузел, вид из окна)
export const CATEGORY_MEDIA: Record<number, { cover: string; photos: string[] }> = {
  1: categoryMedia(1),
  2: categoryMedia(2),
  3: categoryMedia(3),
  4: categoryMedia(4),
  5: categoryMedia(5),
};

// ==========================================
// 1. Interactive Room Map API (Java Spring Boot Backend: /api/interactive-rooms)
// ==========================================
export const interactiveRoomsApi = {
  list: async (filters?: {
    floor?: number;
    status?: RoomStatus | 'ALL';
    categoryId?: number;
    isStaff?: boolean;
  }): Promise<InteractiveRoom[]> => {
    const list = await get<InteractiveRoom[]>(
      `/api/interactive-rooms${query({
        floor: filters?.floor,
        status: filters?.status === 'ALL' ? undefined : filters?.status,
        categoryId: filters?.categoryId,
      })}`
    );
    return list.map((r) => ({
      ...r,
      photos: r.photos && r.photos.length > 0 ? r.photos : CATEGORY_MEDIA[r.categoryId]?.photos || [],
    }));
  },

  get: async (id: number, _isStaff: boolean = false): Promise<InteractiveRoom | null> => {
    const room = await get<InteractiveRoom>(`/api/interactive-rooms/${id}`);
    if (!room) return null;
    return {
      ...room,
      photos: room.photos && room.photos.length > 0 ? room.photos : CATEGORY_MEDIA[room.categoryId]?.photos || [],
    };
  },

  updateStatus: async (
    id: number,
    status: RoomStatus,
    extra?: { guestName?: string; voucherCode?: string; checkInDate?: string; checkOutDate?: string; notes?: string }
  ): Promise<InteractiveRoom> => {
    const room = await put<InteractiveRoom>(`/api/interactive-rooms/${id}/status`, {
      status,
      ...extra,
    });
    return {
      ...room,
      photos: room.photos && room.photos.length > 0 ? room.photos : CATEGORY_MEDIA[room.categoryId]?.photos || [],
    };
  },

  stats: async () => {
    return get<{
      total: number;
      vacant: number;
      occupied: number;
      cleaning: number;
      reserved: number;
      occupancyPercent: number;
    }>('/api/interactive-rooms/stats');
  },
};

// ==========================================
// 2. Smart Recommendations Knowledge Base (Идея 3)
// ==========================================
export const HEALTH_GOALS: HealthGoalOption[] = [
  {
    id: 'CARDIO',
    title: 'Здоровое сердце и сосуды',
    icon: 'heart',
    description: 'Нормализация артериального давления, укрепление сосудов, восстановление ритма и профилактика инфарктов.',
    recommendedProfileId: 1,
    recommendedProfileName: 'Болезни системы кровообращения (Кардиологический)',
    recommendedDietId: 1,
    recommendedDietName: 'Диета №10 (Гипотензивная)',
    recommendedDurationDays: 14,
    matchingPackageId: 1, // "Здоровое сердце"
    recommendedProcedures: [
      { name: 'Сухие углекислые ванны «Реабокс»', benefit: 'Улучшают микроциркуляцию без гидростатической нагрузки на сердце', durationMin: 20 },
      { name: 'Спелеотерапия (соляная комната)', benefit: 'Насыщает кровь кислородом, успокаивает сосудистый тонус', durationMin: 40 },
      { name: 'Электрофорез с сульфатом магния', benefit: 'Снижает сосудистые спазмы и стабилизирует давление', durationMin: 15 },
      { name: 'Лечебная гимнастика в кардио-группе', benefit: 'Дозированная аэробная нагрузка под контролем врача', durationMin: 30 },
    ],
    cautions: ['Высокотемпературные сауны', 'Контрастные обливания', 'Интенсивный силовой гидромассаж'],
    lifestyleAdvice: 'Рекомендуются ежедневные прогулки по терренкуру №1 (ровная аллея) и ограничение соли в рационе.',
  },
  {
    id: 'JOINTS',
    title: 'Легкие суставы и здоровая спина',
    icon: 'pulse',
    description: 'Снятие воспаления и боли в позвоночнике и суставах, улучшение подвижности при артрозах и остеохондрозе.',
    recommendedProfileId: 2,
    recommendedProfileName: 'Костно-мышечная система и суставы',
    recommendedDietId: 1,
    recommendedDietName: 'Диета №15 (Полноценный сбалансированный рацион)',
    recommendedDurationDays: 14,
    matchingPackageId: 4, // "Лёгкие суставы и позвоночник"
    recommendedProcedures: [
      { name: 'Грязевые аппликации сапропелями оз. Дикое', benefit: 'Глубокое противовоспалительное и регенерирующее действие минералов', durationMin: 25 },
      { name: 'Подводный душ-массаж в минеральной воде', benefit: 'Мягко расслабляет околопозвоночные мышцы без нагрузки на суставы', durationMin: 20 },
      { name: 'Магнитотерапия на суставы', benefit: 'Снимает отёчность околосуставных тканей и купирует болевой синдром', durationMin: 15 },
      { name: 'Лечебное плавание в бассейне с минеральной водой', benefit: 'Разгрузка позвоночника при укреплении мышечного корсета', durationMin: 45 },
    ],
    cautions: ['Прыжковые нагрузки', 'Охлаждение суставов'],
    lifestyleAdvice: 'Пациентам с затрудненным передвижением рекомендуется выбор 1 этажа (без ступеней).',
  },
  {
    id: 'RESPIRATORY',
    title: 'Чистое дыхание и крепкий иммунитет',
    icon: 'waves',
    description: 'Очищение бронхов, реабилитация после пневмоний и бронхитов, укрепление местного иммунитета слизистых.',
    recommendedProfileId: 3,
    recommendedProfileName: 'Органы дыхания и пульмонология',
    recommendedDietId: 1,
    recommendedDietName: 'Общий стол',
    recommendedDurationDays: 12,
    matchingPackageId: 3, // "Свободное дыхание"
    recommendedProcedures: [
      { name: 'Галотерапия в соляной пещере', benefit: 'Ионизированный аэрозоль соли очищает бронхиальное дерево от слизи', durationMin: 45 },
      { name: 'Ультразвуковые ингаляции с минеральной водой', benefit: 'Снимают раздражение и увлажняют дыхательные пути', durationMin: 15 },
      { name: 'Дыхательная гимнастика по Стрельниковой', benefit: 'Увеличивает жизненную емкость лёгких и кислородный обмен', durationMin: 30 },
      { name: 'Аромафитотерапия эфирными маслами хвои и эвкалипта', benefit: 'Природный антисептик с бактерицидным действием', durationMin: 20 },
    ],
    cautions: ['Аллергены пыльцы в период цветения'],
    lifestyleAdvice: 'Показан активный терренкур по тропе соснового бора 2 раза в день (утром и перед сном).',
  },
  {
    id: 'ANTISTRESS',
    title: 'Антистресс, крепкий сон и релакс',
    icon: 'leaf',
    description: 'Снятие эмоционального выгорания, лечение хронической усталости, восстановление фаз глубокого сна.',
    recommendedProfileId: 4,
    recommendedProfileName: 'Нервная система и эмоциональное восстановление',
    recommendedDietId: 2,
    recommendedDietName: 'Диета №5 (Щадящая легкоусвояемая)',
    recommendedDurationDays: 10,
    matchingPackageId: 2, // "Антистресс и Релакс"
    recommendedProcedures: [
      { name: 'Жемчужно-хвойные ванны с лавандой', benefit: 'Седативный эффект, глубокое расслабление центральной нервной системы', durationMin: 20 },
      { name: 'Релакс-массаж шейно-воротниковой зоны', benefit: 'Снимает спазмы трапециевидных мышц и головные боли напряжения', durationMin: 25 },
      { name: 'Кедровая фитобочка с бальзамами', benefit: 'Мягкий прогрев, вывод токсинов и улучшение сна', durationMin: 20 },
      { name: 'Сбор фиточая «Успокоительный» в фитобаре', benefit: 'Пустырник, мята, мелисса и зверобой для гармонизации сна', durationMin: 15 },
    ],
    cautions: ['Кофеин во второй половине дня', 'Поздний просмотр гаджетов'],
    lifestyleAdvice: 'Соблюдение вечернего режима тишины после 22:00 и прогулки вдоль озера.',
  },
  {
    id: 'DETOX_METABOLISM',
    title: 'Детокс, метаболизм и тонус',
    icon: 'sparkles',
    description: 'Активация обмена веществ, мягкая очистка организма, нормализация уровня сахара и веса.',
    recommendedProfileId: 5,
    recommendedProfileName: 'Общеоздоровительный и велнес',
    recommendedDietId: 1,
    recommendedDietName: 'Диета №8 / №9 (Метаболическая, с ограничением быстрых углеводов)',
    recommendedDurationDays: 14,
    matchingPackageId: undefined,
    recommendedProcedures: [
      { name: 'Минеральный питьевой курс из природного источника', benefit: 'Стимулирует ферментативную активность ЖКТ и печени', durationMin: 10 },
      { name: 'Душ Шарко / Циркулярный душ', benefit: 'Мощный лимфодренаж, повышение тургора кожи и сжигание калорий', durationMin: 15 },
      { name: 'Аквааэробика в бассейне', benefit: 'Кардиотренировка без перегрузки суставов для ускорения метаболизма', durationMin: 40 },
      { name: 'Прессотерапия (аппаратный лимфодренаж)', benefit: 'Выводит избыточную жидкость, уменьшает отёчность ног', durationMin: 30 },
    ],
    cautions: ['Тяжелая жареная пища'],
    lifestyleAdvice: 'Соблюдение водного баланса (1.5–2 литра минеральной и чистой воды в сутки).',
  },
];

export const smartRecommendationsApi = {
  getGoals: (): HealthGoalOption[] => HEALTH_GOALS,

  recommend: async (input: {
    goalId: string;
    hasMobilityIssue?: boolean;
    allergies?: string[];
    nights?: number;
  }): Promise<HealthRecommendationResult> => {
    const goal = HEALTH_GOALS.find((g) => g.id === input.goalId) || HEALTH_GOALS[0];
    const duration = input.nights || goal.recommendedDurationDays;

    let floorNote = 'Подойдёт любой этаж с 1 по 3.';
    let matchScore = 95;

    if (input.hasMobilityIssue) {
      floorNote = 'Рекомендован 1 этаж (без подъема по лестницам) для максимального комфорта.';
      matchScore += 3;
    }

    // Filter procedures if user has specific allergies
    const userAllergies = (input.allergies || []).map((a) => a.toLowerCase());
    const contraindicationsAlert: string[] = [];

    const safeProcedures = goal.recommendedProcedures.filter((p) => {
      const pLower = p.name.toLowerCase();
      if (userAllergies.some((a) => a.includes('хво') || a.includes('эвкалипт')) && (pLower.includes('хвойн') || pLower.includes('эвкалипт'))) {
        contraindicationsAlert.push(`Процедура «${p.name}» заменена на альтернативную из-за аллергии на хвою/эфирные масла.`);
        return false;
      }
      if (userAllergies.some((a) => a.includes('гряз')) && pLower.includes('грязев')) {
        contraindicationsAlert.push(`Процедура «${p.name}» исключена из-за чувствительности к минеральным грязям.`);
        return false;
      }
      return true;
    });

    // Check if there is a matching package
    let packageSuggestion;
    if (goal.matchingPackageId) {
      try {
        const allPkgs = await packagesApi.list();
        packageSuggestion = allPkgs.find((p) => p.id === goal.matchingPackageId && (p.isActive ?? (p as any).active));
      } catch {
        // Fallback gracefully if packages service is unreachable
      }
    }

    return {
      goal,
      profileId: goal.recommendedProfileId,
      profileName: goal.recommendedProfileName,
      dietId: goal.recommendedDietId,
      dietName: goal.recommendedDietName,
      recommendedFloorNote: floorNote,
      procedures: safeProcedures,
      contraindicationsAlert,
      suggestedDurationNights: duration,
      matchScore: Math.min(99, matchScore),
      packageSuggestion,
    };
  },
};

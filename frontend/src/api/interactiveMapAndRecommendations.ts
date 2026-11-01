import { get, put, query } from './client';
import type {
  HealthGoalOption,
  HealthRecommendationResult,
  InteractiveRoom,
  RoomStatus,
} from '../types';
import { packagesApi } from './biAndOperations';

// Качественный фотофонд категорий и номеров санатория (высокое разрешение, интерьеры, виды и санузлы)
export const CATEGORY_MEDIA: Record<number, { cover: string; photos: string[] }> = {
  1: {
    cover: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80',
    photos: [
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1000&q=80',
    ],
  },
  2: {
    cover: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1000&q=80',
    photos: [
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1000&q=80',
    ],
  },
  3: {
    cover: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80',
    photos: [
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80',
    ],
  },
  4: {
    cover: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80',
    photos: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=1000&q=80',
    ],
  },
  5: {
    cover: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1000&q=80',
    photos: [
      'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80',
    ],
  },
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
    icon: '❤️',
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
    icon: '🦴',
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
    icon: '🫁',
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
    icon: '🌿',
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
    icon: '✨',
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
      floorNote = '⚠️ Рекомендован 1 этаж (без подъема по лестницам) для максимального комфорта.';
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

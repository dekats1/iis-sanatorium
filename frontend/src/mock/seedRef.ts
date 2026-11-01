// Справочные данные санатория «Беловежские дали» (вымышленное название).
import type { Cabinet, Coded, Customer, Procedure, SalesChannel } from '../types';
import type { CategoryRec, RoomRec } from './db';

export const SANATORIUM_NAME = 'Санаторий «Беловежские дали»';

export const CATEGORIES: CategoryRec[] = [
  { id: 1, name: 'Стандарт', capacityTotal: 2, description: 'Двухместный номер 22 м²: две кровати, санузел, телевизор, холодильник' },
  { id: 2, name: 'Комфорт', capacityTotal: 2, description: 'Улучшенный номер 28 м²: балкон, кондиционер, мини-бар, фен' },
  { id: 3, name: 'Люкс', capacityTotal: 2, description: 'Двухкомнатный люкс 46 м²: гостиная и спальня, балкон с видом на озеро' },
  { id: 4, name: 'Семейный', capacityTotal: 4, description: 'Семейный номер 54 м²: две спальни, общая гостиная, детская кроватка по запросу' },
  { id: 5, name: 'Апартаменты', capacityTotal: 4, description: 'Апартаменты 72 м²: две спальни, кухонная зона, терраса, ванна с гидромассажем' },
];

/** Базовая цена за место в сутки, BYN. */
export const BASE_PRICE: Record<number, number> = { 1: 92, 2: 118, 3: 165, 4: 105, 5: 210 };

const AMENITIES: Record<number, string[]> = {
  1: ['Телевизор', 'Холодильник', 'Санузел с душем', 'Чайник'],
  2: ['Балкон', 'Кондиционер', 'Мини-бар', 'Фен', 'Телевизор'],
  3: ['Гостиная', 'Балкон с видом на озеро', 'Кондиционер', 'Мини-бар', 'Халаты и тапочки'],
  4: ['Две спальни', 'Гостиная', 'Детская кроватка по запросу', 'Холодильник', 'Телевизор'],
  5: ['Две спальни', 'Кухонная зона', 'Терраса', 'Ванна с гидромассажем', 'Кондиционер'],
};
const VIEWS = ['на лесной массив', 'на озеро', 'во внутренний двор', 'на центральную аллею', 'на сосновый бор'];

/** 3 корпуса × 3 этажа × 10 номеров = 90 номеров. */
export function buildRooms(): RoomRec[] {
  const rooms: RoomRec[] = [];
  const buildings = ['Корпус №1 «Главный»', 'Корпус №2 «Лесной»', 'Корпус №3 «Озёрный»'];
  // распределение категорий по корпусам (10 номеров на этаж)
  const layout: number[][] = [
    Array(30).fill(1),
    [...Array(4).fill(1), ...Array(24).fill(2), ...Array(2).fill(4)],
    [...Array(14).fill(3), ...Array(8).fill(4), ...Array(8).fill(5)],
  ];
  let id = 0;
  for (let b = 0; b < 3; b++) {
    for (let f = 1; f <= 3; f++) {
      for (let k = 1; k <= 10; k++) {
        const cat = layout[b][(f - 1) * 10 + (k - 1)];
        id += 1;
        rooms.push({
          id,
          categoryId: cat,
          roomNumber: String(f * 100 + b * 30 + k),
          floor: f,
          building: buildings[b],
          windowView: VIEWS[(id * 7 + b) % VIEWS.length],
          amenities: AMENITIES[cat],
        });
      }
    }
  }
  return rooms;
}

export const PROFILES: Coded[] = [
  { id: 1, code: 'CARDIO', name: 'Болезни системы кровообращения (кардиологический)' },
  { id: 2, code: 'MSK', name: 'Костно-мышечная система и суставы' },
  { id: 3, code: 'RESP', name: 'Органы дыхания и пульмонология' },
  { id: 4, code: 'NEURO', name: 'Нервная система и эмоциональное восстановление' },
  { id: 5, code: 'WELLNESS', name: 'Общеоздоровительный и велнес' },
  { id: 6, code: 'GI', name: 'Органы пищеварения' },
];

export const DIETS: Coded[] = [
  { id: 1, code: 'DIET-15', name: 'Диета №15 (общий стол)' },
  { id: 2, code: 'DIET-5', name: 'Диета №5 (щадящая)' },
  { id: 3, code: 'DIET-9', name: 'Диета №9 (диабетическая)' },
  { id: 4, code: 'DIET-10', name: 'Диета №10 (гипотензивная, малосолевая)' },
  { id: 5, code: 'DIET-1', name: 'Диета №1 (язвенная)' },
  { id: 6, code: 'VEG', name: 'Вегетарианское меню' },
];

export const CONDITIONS: Coded[] = [
  { id: 1, code: 'I10', name: 'Гипертоническая болезнь' },
  { id: 2, code: 'I25', name: 'Ишемическая болезнь сердца' },
  { id: 3, code: 'I80', name: 'Тромбофлебит' },
  { id: 4, code: 'E11', name: 'Сахарный диабет 2 типа' },
  { id: 5, code: 'J45', name: 'Бронхиальная астма' },
  { id: 6, code: 'M17', name: 'Остеоартроз коленного сустава' },
  { id: 7, code: 'M54', name: 'Остеохондроз позвоночника (дорсопатия)' },
  { id: 8, code: 'K29', name: 'Хронический гастрит' },
  { id: 9, code: 'K25', name: 'Язвенная болезнь желудка' },
  { id: 10, code: 'N11', name: 'Хронический пиелонефрит' },
  { id: 11, code: 'D50', name: 'Железодефицитная анемия' },
  { id: 12, code: 'C80', name: 'Онкологическое заболевание (в анамнезе)' },
  { id: 13, code: 'G40', name: 'Эпилепсия' },
  { id: 14, code: 'O99', name: 'Беременность' },
  { id: 15, code: 'L20', name: 'Атопический дерматит' },
  { id: 16, code: 'E05', name: 'Тиреотоксикоз' },
  { id: 17, code: 'F48', name: 'Неврастения (астенический синдром)' },
];

export const CHANNELS: SalesChannel[] = [
  { id: 1, name: 'Сайт санатория', commissionPct: 0, quotaPlaces: null },
  { id: 2, name: 'Телефон / ресепшен', commissionPct: 0, quotaPlaces: null },
  { id: 3, name: 'Турагентство «Белинтурист-Сервис»', commissionPct: 12, quotaPlaces: 20 },
  { id: 4, name: 'Профсоюзные путёвки (ФПБ)', commissionPct: 5, quotaPlaces: 30 },
  { id: 5, name: 'Корпоративные договоры', commissionPct: 7, quotaPlaces: 25 },
  { id: 6, name: 'Онлайн-агрегатор путёвок', commissionPct: 15, quotaPlaces: 15 },
  { id: 7, name: 'Социальные программы (оздоровление)', commissionPct: 3, quotaPlaces: 40 },
];

export const CUSTOMERS: Customer[] = [
  { id: 1, type: 'ORG', name: 'ОАО «Полесьеагро»', contractNo: 'Д-2026/01' },
  { id: 2, type: 'ORG', name: 'ЗАО «Минск-Транзит»', contractNo: 'Д-2026/04' },
  { id: 3, type: 'ORG', name: 'Областной комитет профсоюза работников образования', contractNo: 'Д-2025/17' },
  { id: 4, type: 'ORG', name: 'ООО «Новый Двор Строй»', contractNo: 'Д-2026/09' },
  { id: 5, type: 'ORG', name: 'КУП «Брестжилкомхоз»', contractNo: 'Д-2025/23' },
  { id: 6, type: 'PERSON', name: 'Ковальчук Игорь Станиславович', contractNo: null },
  { id: 7, type: 'ORG', name: 'ОАО «Могилёвхимволокно» (профком)', contractNo: 'Д-2026/12' },
  { id: 8, type: 'ORG', name: 'Республиканский центр медицинской реабилитации', contractNo: 'Д-2024/31' },
];

export const CABINETS: Cabinet[] = [
  { id: 1, name: 'Водолечебница (ванны и души)', slotsPerDay: 36 },
  { id: 2, name: 'Грязелечебница', slotsPerDay: 24 },
  { id: 3, name: 'Кабинет физиотерапии', slotsPerDay: 40 },
  { id: 4, name: 'Кабинет магнито- и лазеротерапии', slotsPerDay: 30 },
  { id: 5, name: 'Ингалятор', slotsPerDay: 36 },
  { id: 6, name: 'Галокамера (соляная пещера)', slotsPerDay: 20 },
  { id: 7, name: 'Массажный кабинет', slotsPerDay: 30 },
  { id: 8, name: 'Зал лечебной физкультуры', slotsPerDay: 24 },
  { id: 9, name: 'Бассейн с минеральной водой', slotsPerDay: 24 },
  { id: 10, name: 'Кабинет функциональной диагностики', slotsPerDay: 20 },
  { id: 11, name: 'Кабинет электросна и психотерапии', slotsPerDay: 20 },
  { id: 12, name: 'Питьевой бювет и фитобар', slotsPerDay: 40 },
  { id: 13, name: 'Кабинет ультразвуковой и ударно-волновой терапии', slotsPerDay: 24 },
  { id: 14, name: 'Кабинет лимфодренажа', slotsPerDay: 16 },
];

interface ProcDef { key: string; name: string; min: number; cab: number; profiles: number[]; contra: number[] }
const P: ProcDef[] = [
  { key: 'min_bath', name: 'Минеральная ванна', min: 20, cab: 1, profiles: [1, 2, 4, 5, 6], contra: [12, 14] },
  { key: 'pearl', name: 'Жемчужная ванна', min: 20, cab: 1, profiles: [1, 4, 5], contra: [14] },
  { key: 'pine', name: 'Хвойная ванна', min: 20, cab: 1, profiles: [1, 4], contra: [14, 15] },
  { key: 'co2', name: 'Сухая углекислая ванна «Реабокс»', min: 20, cab: 1, profiles: [1], contra: [12, 14] },
  { key: 'underwater', name: 'Подводный душ-массаж', min: 20, cab: 1, profiles: [2, 5], contra: [3, 12, 14] },
  { key: 'charcot', name: 'Душ Шарко', min: 15, cab: 1, profiles: [2, 5], contra: [1, 2, 3, 12, 14] },
  { key: 'circular', name: 'Циркулярный душ', min: 15, cab: 1, profiles: [4, 5], contra: [3] },
  { key: 'mud', name: 'Грязелечение (аппликации сапропеля)', min: 25, cab: 2, profiles: [2, 6], contra: [2, 3, 12, 14, 16] },
  { key: 'ozokerit', name: 'Озокерито-парафиновые аппликации', min: 25, cab: 2, profiles: [2], contra: [3, 12, 14, 16] },
  { key: 'electro', name: 'Электрофорез лекарственный', min: 15, cab: 3, profiles: [1, 2, 3, 6], contra: [12, 14, 15] },
  { key: 'smt', name: 'СМТ-терапия (амплипульс)', min: 15, cab: 3, profiles: [1, 2, 6], contra: [12, 13, 14] },
  { key: 'darsonval', name: 'Дарсонвализация', min: 10, cab: 3, profiles: [2, 4], contra: [3, 12, 13, 14] },
  { key: 'diadyn', name: 'Диадинамотерапия', min: 15, cab: 3, profiles: [2], contra: [3, 12, 14] },
  { key: 'uhf', name: 'УВЧ-терапия', min: 10, cab: 3, profiles: [3], contra: [12, 14, 16] },
  { key: 'magnet', name: 'Магнитотерапия', min: 15, cab: 4, profiles: [1, 2, 4], contra: [12, 13, 14, 16] },
  { key: 'laser', name: 'Лазеротерапия', min: 10, cab: 4, profiles: [2, 3], contra: [12, 14, 16] },
  { key: 'inh_us', name: 'Ингаляции ультразвуковые', min: 15, cab: 5, profiles: [3], contra: [] },
  { key: 'inh_alk', name: 'Ингаляции щелочные', min: 15, cab: 5, profiles: [3, 6], contra: [] },
  { key: 'aroma', name: 'Аромафитотерапия', min: 20, cab: 5, profiles: [3, 4], contra: [5, 14, 15] },
  { key: 'halo', name: 'Галотерапия', min: 45, cab: 6, profiles: [3, 5], contra: [12, 14] },
  { key: 'speleo', name: 'Спелеотерапия (соляная комната)', min: 40, cab: 6, profiles: [1, 3, 5], contra: [12, 14] },
  { key: 'mass_back', name: 'Классический массаж спины', min: 20, cab: 7, profiles: [2, 4, 5], contra: [3, 12, 14] },
  { key: 'mass_neck', name: 'Массаж шейно-воротниковой зоны', min: 15, cab: 7, profiles: [2, 4], contra: [3, 12] },
  { key: 'mass_relax', name: 'Релакс-массаж', min: 25, cab: 7, profiles: [4, 5], contra: [3, 12] },
  { key: 'lfk', name: 'Лечебная физкультура (групповое занятие)', min: 30, cab: 8, profiles: [1, 2, 3, 4], contra: [] },
  { key: 'breath', name: 'Дыхательная гимнастика', min: 30, cab: 8, profiles: [1, 3], contra: [] },
  { key: 'terrenkur', name: 'Терренкур (дозированная ходьба)', min: 40, cab: 8, profiles: [1, 5], contra: [] },
  { key: 'swim', name: 'Лечебное плавание', min: 45, cab: 9, profiles: [1, 2, 5], contra: [15] },
  { key: 'aqua', name: 'Аквааэробика', min: 40, cab: 9, profiles: [2, 5], contra: [] },
  { key: 'ecg', name: 'ЭКГ с нагрузочной пробой', min: 15, cab: 10, profiles: [1], contra: [] },
  { key: 'electrosleep', name: 'Электросон', min: 30, cab: 11, profiles: [4], contra: [12, 13, 14] },
  { key: 'psycho', name: 'Психотерапевтическая консультация', min: 40, cab: 11, profiles: [4, 5], contra: [] },
  { key: 'drink', name: 'Питьевое лечение минеральной водой', min: 10, cab: 12, profiles: [5, 6], contra: [9, 10] },
  { key: 'phyto', name: 'Фитотерапия (травяной чай)', min: 10, cab: 12, profiles: [4, 5, 6], contra: [] },
  { key: 'us', name: 'Ультразвуковая терапия', min: 15, cab: 13, profiles: [2, 6], contra: [12, 13, 14] },
  { key: 'swt', name: 'Ударно-волновая терапия', min: 20, cab: 13, profiles: [2], contra: [3, 11, 12, 14] },
  { key: 'press', name: 'Прессотерапия (аппаратный лимфодренаж)', min: 30, cab: 14, profiles: [1, 5], contra: [3, 12, 14] },
];

export const PROCEDURES: Procedure[] = P.map((p, i) => ({ id: i + 1, name: p.name, durationMin: p.min, cabinetId: p.cab }));
export const PROC_PROFILE: [number, number][] = P.flatMap((p, i) => p.profiles.map((pr) => [pr, i + 1] as [number, number]));
export const CONTRA: [number, number][] = P.flatMap((p, i) => p.contra.map((c) => [i + 1, c] as [number, number]));
export const PROC_KEY: Record<string, number> = Object.fromEntries(P.map((p, i) => [p.key, i + 1]));

/** Состояния здоровья, характерные для профиля. */
export const PROFILE_CONDITIONS: Record<number, number[]> = {
  1: [1, 1, 2, 4, 3],
  2: [6, 7, 7, 4],
  3: [5, 5, 4],
  4: [17, 17, 1, 7],
  5: [4, 1, 11],
  6: [8, 8, 9, 10],
};

export const ALLERGIES = ['Пыльца', 'Пенициллин', 'Цитрусовые', 'Мёд', 'Хвойные эфирные масла', 'Орехи', 'Бытовая пыль'];

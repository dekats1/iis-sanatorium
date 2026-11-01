import type { IconName } from '../icons';

/** Описание поля справочника для универсального редактора. */
export interface FieldSpec {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  required?: boolean;
  placeholder?: string;
  hint?: string;
}

export interface ResourceSpec {
  key: string;
  title: string;
  icon: IconName;
  description: string;
  fields: FieldSpec[];
}

export const RESOURCES: ResourceSpec[] = [
  {
    key: 'room-categories',
    title: 'Категории номеров',
    icon: 'bed',
    description: 'Категории номерного фонда, базовые вместимости и описания комфортности.',
    fields: [
      { key: 'name', label: 'Название категории', type: 'text', required: true, placeholder: 'Люкс двухкомнатный' },
      { key: 'capacityTotal', label: 'Вместимость (мест в номере)', type: 'number', required: true, placeholder: '2' },
      { key: 'description', label: 'Описание и удобства', type: 'text', placeholder: 'Кондиционер, балкон с видом на лес' },
    ],
  },
  {
    key: 'rooms',
    title: 'Номера',
    icon: 'key',
    description: 'Конкретные жилые комнаты санатория, привязка к категориям и этажам.',
    fields: [
      { key: 'categoryId', label: 'Категория номера', type: 'select', required: true },
      { key: 'roomNumber', label: 'Номер комнаты', type: 'text', required: true, placeholder: '305' },
      { key: 'floor', label: 'Этаж', type: 'number', placeholder: '3' },
    ],
  },
  {
    key: 'treatment-profiles',
    title: 'Лечебные профили',
    icon: 'stethoscope',
    description: 'Медицинские направления санаторно-курортного оздоровления.',
    fields: [
      { key: 'code', label: 'Код профиля', type: 'text', placeholder: 'CARDIO', hint: 'Латиница, без пробелов' },
      { key: 'name', label: 'Наименование профиля', type: 'text', required: true, placeholder: 'Кардиологический' },
    ],
  },
  {
    key: 'cabinets',
    title: 'Кабинеты',
    icon: 'home',
    description: 'Лечебные и процедурные кабинеты, пропускная способность.',
    fields: [
      { key: 'name', label: 'Название кабинета', type: 'text', required: true, placeholder: 'Кабинет №12 (Водолечебница)' },
      { key: 'slotsPerDay', label: 'Сеансов в день (пропускная способность)', type: 'number', required: true, placeholder: '16' },
    ],
  },
  {
    key: 'procedures',
    title: 'Процедуры',
    icon: 'droplet',
    description: 'Медицинские и оздоровительные процедуры, длительность и закреплённый кабинет.',
    fields: [
      { key: 'name', label: 'Название процедуры', type: 'text', required: true, placeholder: 'Минеральная ванна' },
      { key: 'durationMin', label: 'Длительность (минут)', type: 'number', required: true, placeholder: '30' },
      { key: 'cabinetId', label: 'Кабинет проведения', type: 'select', required: true },
    ],
  },
  {
    key: 'diets',
    title: 'Диеты',
    icon: 'leaf',
    description: 'Столы лечебного и диетического питания.',
    fields: [
      { key: 'code', label: 'Код стола', type: 'text', placeholder: 'DIET-05' },
      { key: 'name', label: 'Название диеты', type: 'text', required: true, placeholder: 'Диета №5 (щадящая)' },
    ],
  },
  {
    key: 'sales-channels',
    title: 'Каналы продаж',
    icon: 'map',
    description: 'Партнёрские и прямые каналы дистрибуции путёвок, агентские комиссии и квоты.',
    fields: [
      { key: 'name', label: 'Канал продаж', type: 'text', required: true, placeholder: 'Ostrovok.ru' },
      { key: 'commissionPct', label: 'Комиссия партнёра (%)', type: 'number', required: true, placeholder: '15', hint: 'От 0 до 100' },
      { key: 'quotaPlaces', label: 'Квота мест', type: 'number', placeholder: '10' },
    ],
  },
  {
    key: 'medical-conditions',
    title: 'Состояния здоровья',
    icon: 'clipboard',
    description: 'Диагнозы, показания и противопоказания гостей.',
    fields: [
      { key: 'code', label: 'Код МКБ / Системный код', type: 'text', required: true, placeholder: 'I10' },
      { key: 'name', label: 'Наименование состояния', type: 'text', required: true, placeholder: 'Артериальная гипертензия' },
    ],
  },
  {
    key: 'customers',
    title: 'Заказчики',
    icon: 'users',
    description: 'Юридические лица и партнёры, заключающие корпоративные договоры на заезд групп.',
    fields: [
      { key: 'type', label: 'Тип заказчика', type: 'select', required: true },
      { key: 'name', label: 'Название организации / ФИО', type: 'text', required: true, placeholder: 'ОАО «Беларуськалий»' },
      { key: 'contractNo', label: 'Номер договора', type: 'text', placeholder: 'Д-2026/04' },
    ],
  },
];

/** Поля-селекты со строковыми значениями (не ссылки на другие справочники). */
export const TEXT_SELECTS: Record<string, Record<string, string[]>> = {
  customers: { type: ['ORG', 'PERSON'] },
};

export const CUSTOMER_TYPE_NAMES: Record<string, string> = {
  ORG: 'Организация (Юр. лицо)',
  PERSON: 'Физическое лицо',
};

export type RefOptions = Record<string, { value: number; label: string }[]>;

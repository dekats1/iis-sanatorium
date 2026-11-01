/**
 * Утилиты для работы с аватарами и фото профиля:
 * - Сжатие и квадратное кадрирование (HTML5 Canvas) в WebP/JPEG Base64
 * - Локальное персистентное хранилище (localStorage) с реактивными событиями
 * - Набор стилизованных пресетов-аватарок санатория
 */

const AVATAR_PREFIX = 'sanatorium_avatar_';
const AVATAR_EVENT = 'sanatorium:avatar_changed';

export interface PresetAvatar {
  id: string;
  name: string;
  description: string;
  url: string;
}

// Стилизованные векторные аватары в санаторной тематике (Data URL)
export const PRESET_AVATARS: PresetAvatar[] = [
  {
    id: 'pine',
    name: 'Сосновый бор',
    description: 'Целебный хвойный лес и чистый воздух',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23064e3b"/><stop offset="100%" stop-color="%230d9488"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g1)" rx="50"/><path d="M50 18 L68 44 L58 44 L74 66 L26 66 L42 44 L32 44 Z" fill="%23a7f3d0"/><rect x="46" y="66" width="8" height="14" fill="%23042f2e" rx="2"/></svg>`,
  },
  {
    id: 'lake',
    name: 'Озеро Дикое',
    description: 'Спокойная гладь лесного озера',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%230369a1"/><stop offset="100%" stop-color="%2338bdf8"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g2)" rx="50"/><circle cx="50" cy="38" r="14" fill="%23fef08a"/><path d="M15 68 Q32 60 50 68 T85 68 L85 85 L15 85 Z" fill="%230284c7" opacity="0.8"/><path d="M15 76 Q32 70 50 76 T85 76 L85 85 L15 85 Z" fill="%23bae6fd" opacity="0.6"/></svg>`,
  },
  {
    id: 'lotus',
    name: 'СПА и релакс',
    description: 'Восстановление гармонии и сил',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23115e59"/><stop offset="100%" stop-color="%2314b8a6"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g3)" rx="50"/><path d="M50 22 C42 38 42 58 50 72 C58 58 58 38 50 22 Z" fill="%23ccfbf1"/><path d="M50 72 C32 65 24 45 30 35 C38 48 42 62 50 72 Z" fill="%2399f6e4"/><path d="M50 72 C68 65 76 45 70 35 C62 48 58 62 50 72 Z" fill="%2399f6e4"/></svg>`,
  },
  {
    id: 'sun',
    name: 'Горное утро',
    description: 'Энергия солнца и климатолечение',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23b45309"/><stop offset="100%" stop-color="%23fbbf24"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g4)" rx="50"/><circle cx="50" cy="42" r="18" fill="%23fffbeb"/><path d="M20 78 L42 48 L58 68 L66 56 L82 78 Z" fill="%2378350f" opacity="0.9"/></svg>`,
  },
  {
    id: 'herbal',
    name: 'Фитотерапия',
    description: 'Травяные сборы и природные силы',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2315803d"/><stop offset="100%" stop-color="%2386efac"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g5)" rx="50"/><path d="M50 76 C50 76 34 60 34 40 C34 26 50 20 50 20 C50 20 66 26 66 40 C66 60 50 76 50 76 Z" fill="%23dcfce7"/><path d="M50 25 L50 72 M50 40 L38 32 M50 50 L62 42 M50 58 L40 52" stroke="%23166534" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'doctor',
    name: 'Медицинский штаб',
    description: 'Забота врачей и оздоровительный контроль',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g6" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%231e40af"/><stop offset="100%" stop-color="%2360a5fa"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g6)" rx="50"/><circle cx="50" cy="38" r="14" fill="%23eff6ff"/><path d="M26 78 C26 62 38 56 50 56 C62 56 74 62 74 78 Z" fill="%23dbeafe"/><rect x="46" y="62" width="8" height="12" fill="%23ef4444" rx="1"/><rect x="44" y="64" width="12" height="8" fill="%23ef4444" rx="1"/></svg>`,
  },
];

const inMemoryAvatarStore: Record<string, string> = {};
type AvatarListener = (e: CustomEvent) => void;
const inMemoryListeners: AvatarListener[] = [];

export function getUserAvatar(key?: string | number | null): string | null {
  if (!key) return null;
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(`${AVATAR_PREFIX}${key}`);
    }
  } catch {
    // fallback
  }
  return inMemoryAvatarStore[`${AVATAR_PREFIX}${key}`] || null;
}

export function setUserAvatar(key: string | number, dataUrl: string | null): void {
  try {
    if (typeof localStorage !== 'undefined') {
      if (dataUrl) {
        localStorage.setItem(`${AVATAR_PREFIX}${key}`, dataUrl);
      } else {
        localStorage.removeItem(`${AVATAR_PREFIX}${key}`);
      }
    }
  } catch {
    // fallback
  }

  if (dataUrl) {
    inMemoryAvatarStore[`${AVATAR_PREFIX}${key}`] = dataUrl;
  } else {
    delete inMemoryAvatarStore[`${AVATAR_PREFIX}${key}`];
  }

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(AVATAR_EVENT, { detail: { key, avatarUrl: dataUrl } }));
  } else {
    const fakeEvent = { detail: { key, avatarUrl: dataUrl } } as unknown as CustomEvent;
    inMemoryListeners.forEach((fn) => fn(fakeEvent));
  }
}

export function onAvatarChange(callback: (event: CustomEvent) => void): () => void {
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const handler = (e: Event) => callback(e as CustomEvent);
    window.addEventListener(AVATAR_EVENT, handler);
    return () => window.removeEventListener(AVATAR_EVENT, handler);
  } else {
    inMemoryListeners.push(callback);
    return () => {
      const idx = inMemoryListeners.indexOf(callback);
      if (idx !== -1) inMemoryListeners.splice(idx, 1);
    };
  }
}

/**
 * Сжимает пользовательское изображение до квадратного аватара 256x256 WebP/JPEG
 */
export function compressImage(file: File, maxDim = 256, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Пожалуйста, выберите файл изображения (JPG, PNG или WebP)'));
    }

    if (file.size > 10 * 1024 * 1024) {
      return reject(new Error('Размер исходного файла не должен превышать 10 МБ'));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Квадратное центрированное кадрирование
        const minSide = Math.min(img.width, img.height);
        const startX = (img.width - minSide) / 2;
        const startY = (img.height - minSide) / 2;

        const canvas = document.createElement('canvas');
        const targetDim = Math.min(maxDim, minSide);
        canvas.width = targetDim;
        canvas.height = targetDim;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Не удалось инициализировать графический контекст браузера'));
        }

        // Высокое качество интерполяции
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(
          img,
          startX,
          startY,
          minSide,
          minSide,
          0,
          0,
          targetDim,
          targetDim
        );

        // WebP с фоллбэком на JPEG
        try {
          const webpUrl = canvas.toDataURL('image/webp', quality);
          if (webpUrl.startsWith('data:image/webp')) {
            return resolve(webpUrl);
          }
        } catch {
          // ignore
        }

        const jpegUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(jpegUrl);
      };

      img.onerror = () => reject(new Error('Не удалось прочитать выбранное изображение'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Ошибка чтения файла с диска'));
    reader.readAsDataURL(file);
  });
}

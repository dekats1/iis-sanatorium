-- V5: Интерактивная карта номеров и центр уведомлений пользователей

-- 1. Добавление категорий 4 и 5 для полноты номерного фонда
INSERT INTO room_categories (name, capacity_total, description)
VALUES 
    ('Семейный двухкомнатный', 4, 'Просторный двухкомнатный номер для семейного отдыха с детьми'),
    ('Президентский сюит', 3, 'Премиальный номер высшей категории с персональной террасой и финской сауной')
ON CONFLICT DO NOTHING;

-- 2. Расширение таблицы номеров атрибутами интерактивной карты
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'VACANT';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS window_view VARCHAR(150) DEFAULT 'Парковая аллея';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS amenities TEXT DEFAULT 'Wi-Fi, Телевизор, Холодильник, Санузел';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS building VARCHAR(100) NOT NULL DEFAULT 'Главный спальный корпус';

-- Обновление существующих номеров подробными данными
UPDATE rooms SET 
    status = 'VACANT',
    window_view = 'Парковая аллея',
    amenities = 'Wi-Fi, Телевизор, Холодильник, Душевая кабина, Ортопедические матрасы',
    notes = 'Удобный доступ без лестниц, идеален для пожилых гостей'
WHERE room_number = '101';

UPDATE rooms SET 
    status = 'OCCUPIED',
    window_view = 'Сосновый бор',
    amenities = 'Wi-Fi, Телевизор, Холодильник, Душевая кабина',
    notes = 'Текущий гость: Иванова М.П. (Путёвка #1)'
WHERE room_number = '102';

UPDATE rooms SET 
    status = 'CLEANING',
    window_view = 'Парковая аллея',
    amenities = 'Wi-Fi, Телевизор, Холодильник, Кондиционер, Душевая кабина',
    notes = 'Плановая генеральная уборка и смена белья'
WHERE room_number = '103';

UPDATE rooms SET 
    status = 'VACANT',
    window_view = 'Внутренний сад и фонтан',
    amenities = 'Wi-Fi, Телевизор, Холодильник, Душевая кабина',
    notes = 'Тихий номер с окнами во внутренний дворик'
WHERE room_number = '104';

UPDATE rooms SET 
    status = 'VACANT',
    window_view = 'Сосновый бор',
    amenities = 'Wi-Fi, Кондиционер, Телевизор, Сейф, Мини-бар',
    notes = 'Категория повышенной комфортности'
WHERE room_number = '105';

-- Добавление недостающих номеров до 18 номеров (по 6 на каждый этаж)
INSERT INTO rooms (category_id, room_number, floor, is_active, status, window_view, amenities, notes)
VALUES
    -- 1 этаж (добавляем 106)
    (2, '106', 1, TRUE, 'VACANT', 'Сосновый бор', 'Wi-Fi, Кондиционер, Телевизор, Сейф, Мини-бар', 'Номер на 1 этаже'),
    -- 2 этаж (обновляем 201-204 и добавляем 205, 206)
    (2, '205', 2, TRUE, 'VACANT', 'Сосновый бор', 'Wi-Fi, Кондиционер, Сейф, Балкон, Телевизор', 'Солнечная сторона'),
    (4, '206', 2, TRUE, 'VACANT', 'Парковая аллея и озеро', 'Wi-Fi, Кондиционер, Две спальни, Балкон, Кухонный уголок', 'Семейный номер для отдыха с детьми'),
    -- 3 этаж (добавляем 303, 304, 305, 306)
    (2, '303', 3, TRUE, 'VACANT', 'Сосновый бор', 'Wi-Fi, Кондиционер, Балкон, Телевизор', 'Верхний этаж, красивый вид'),
    (3, '304', 3, TRUE, 'CLEANING', 'Панорама озера', 'Wi-Fi 100 Мб/с, Двуспальная King-size кровать, Джакузи, Терраса', 'Люкс с джакузи, уборка'),
    (1, '305', 3, TRUE, 'RESERVED', 'Парковая аллея', 'Wi-Fi, Балкон, Телевизор, Холодильник', 'Забронирован на заезд на следующей неделе'),
    (5, '306', 3, TRUE, 'VACANT', 'Круговая панорама озера и бора', 'Wi-Fi 100 Мб/с, Индивидуальный кондиционер, Просторная терраса 25 кв.м, Сауна в номере, Джакузи', 'Премиальный номер высшей категории с персональной финской сауной')
ON CONFLICT (room_number) DO UPDATE SET 
    status = EXCLUDED.status,
    window_view = EXCLUDED.window_view,
    amenities = EXCLUDED.amenities,
    notes = EXCLUDED.notes;

UPDATE rooms SET 
    status = 'VACANT',
    window_view = 'Парковая аллея',
    amenities = 'Wi-Fi, Телевизор, Кондиционер, Сейф, Лоджия'
WHERE room_number = '201';

UPDATE rooms SET 
    status = 'OCCUPIED',
    window_view = 'Сосновый бор',
    amenities = 'Wi-Fi, Телевизор, Кондиционер, Сейф, Лоджия',
    notes = 'Гость: Смирнов А.В.'
WHERE room_number = '202';

UPDATE rooms SET 
    status = 'VACANT',
    window_view = 'Внутренний сад',
    amenities = 'Wi-Fi, Телевизор, Кондиционер, Душ'
WHERE room_number = '203';

UPDATE rooms SET 
    status = 'VACANT',
    window_view = 'Сосновый бор',
    amenities = 'Wi-Fi, Телевизор, Кондиционер, Лоджия'
WHERE room_number = '204';

UPDATE rooms SET 
    status = 'VACANT',
    window_view = 'Панорама озера и соснового бора',
    amenities = 'Wi-Fi, Кондиционер, Терраса, Гостиная, Ванная комната с окном, Халаты'
WHERE room_number = '301';

UPDATE rooms SET 
    status = 'OCCUPIED',
    window_view = 'Парковая аллея',
    amenities = 'Wi-Fi, Кондиционер, Терраса, Гостиная, Ванная комната, Халаты',
    notes = 'Гость: Ковалёва И.Б.'
WHERE room_number = '302';

-- 3. Таблица центра уведомлений
CREATE TABLE IF NOT EXISTS app_notifications (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(30) NOT NULL,
    title       VARCHAR(200) NOT NULL,
    message     TEXT NOT NULL,
    link        VARCHAR(255),
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON app_notifications(user_id, created_at DESC);

-- Сеем стартовые системные уведомления для тестовых пользователей
INSERT INTO app_notifications (user_id, type, title, message, link, is_read, created_at)
SELECT u.id, 'LOYALTY', 'Программа лояльности активирована', 'Добро пожаловать в клуб привилегий санатория! Вам начислен приветственный кэшбэк.', '/profile', FALSE, CURRENT_TIMESTAMP - INTERVAL '1 hour'
FROM users u WHERE u.username = 'client'
ON CONFLICT DO NOTHING;

INSERT INTO app_notifications (user_id, type, title, message, link, is_read, created_at)
SELECT u.id, 'INFO', 'Электронная медицинская карта', 'Ваша санаторно-курортная карта СКК-2026/001 успешно внесена в базу данных.', '/profile', FALSE, CURRENT_TIMESTAMP - INTERVAL '30 minutes'
FROM users u WHERE u.username = 'client'
ON CONFLICT DO NOTHING;

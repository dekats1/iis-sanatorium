-- Запасной вариант заполнения БД sanatorium_core без запуска профиля demo.
-- Запускать в psql, подключившись к sanatorium_core: \c sanatorium_core   затем   \i demo-seed-core.sql
-- Пароль всех демо-пользователей: demo12345 (хэш bcrypt считает расширение pgcrypto, формат $2a$ понимает Spring).
-- Скрипт идемпотентный: повторный запуск ничего не дублирует.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO roles (code, name) VALUES
    ('CLIENT','Клиент (отдыхающий / туроператор)'),('BOOKING_ADMIN','Администратор бронирования'),
    ('DOCTOR','Врач'),('MANAGER','Менеджер по доходам'),('SYSADMIN','Системный администратор')
ON CONFLICT (code) DO NOTHING;

INSERT INTO users (username, password_hash, full_name) VALUES
    ('admin',    crypt('demo12345', gen_salt('bf', 10)), 'Администратор бронирования'),
    ('doctor',   crypt('demo12345', gen_salt('bf', 10)), 'Врач'),
    ('manager',  crypt('demo12345', gen_salt('bf', 10)), 'Менеджер по доходам'),
    ('sysadmin', crypt('demo12345', gen_salt('bf', 10)), 'Системный администратор'),
    ('client',   crypt('demo12345', gen_salt('bf', 10)), 'Иванов Иван')
ON CONFLICT (username) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.code = CASE u.username
    WHEN 'admin' THEN 'BOOKING_ADMIN' WHEN 'doctor' THEN 'DOCTOR' WHEN 'manager' THEN 'MANAGER'
    WHEN 'sysadmin' THEN 'SYSADMIN' WHEN 'client' THEN 'CLIENT' END
WHERE u.username IN ('admin','doctor','manager','sysadmin','client')
ON CONFLICT DO NOTHING;

INSERT INTO clients (user_id, last_name, first_name, birth_date)
SELECT u.id, 'Иванов', 'Иван', DATE '1975-03-14' FROM users u
WHERE u.username = 'client' AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.user_id = u.id);

-- порядок вставки задаёт id: 1 — Стандарт, 2 — Комфорт, 3 — Люкс (как ждёт pricing-forecast)
INSERT INTO room_categories (name, capacity_total) VALUES ('Стандарт',2),('Комфорт',2),('Люкс',3)
ON CONFLICT (name) DO NOTHING;

INSERT INTO rooms (category_id, room_number, floor)
SELECT c.id, (c.id*100 + g)::text, c.id
FROM room_categories c JOIN (VALUES ('Стандарт',5),('Комфорт',4),('Люкс',2)) p(n,cnt) ON p.n = c.name
CROSS JOIN LATERAL generate_series(1, p.cnt) g
ON CONFLICT (room_number) DO NOTHING;

INSERT INTO treatment_profiles (code, name) VALUES ('NERV','Нервная система'),('MSK','Опорно-двигательный аппарат')
ON CONFLICT (code) DO NOTHING;
INSERT INTO diets (code, name) VALUES ('D9','Стол № 9'),('D5','Стол № 5') ON CONFLICT (code) DO NOTHING;
INSERT INTO sales_channels (name, commission_pct) VALUES ('Прямые продажи',0),('Туроператор',10)
ON CONFLICT (name) DO NOTHING;

INSERT INTO cabinets (name, slots_per_day) VALUES ('Физиотерапия',8),('Ванны',6),('Массаж',6)
ON CONFLICT (name) DO NOTHING;
INSERT INTO medical_conditions (code, name) VALUES
    ('HYPERTENSION','Гипертоническая болезнь'),('DIABETES','Сахарный диабет'),('ARRHYTHMIA','Нарушения ритма сердца')
ON CONFLICT (code) DO NOTHING;
INSERT INTO procedures (name, duration_min, cabinet_id)
SELECT v.n, v.d, c.id FROM (VALUES ('Жемчужные ванны',20,'Ванны'),('Лечебный массаж',30,'Массаж'),
    ('Электрофорез',15,'Физиотерапия'),('Парафинолечение',25,'Физиотерапия')) v(n,d,cab)
JOIN cabinets c ON c.name = v.cab
ON CONFLICT (name) DO NOTHING;
INSERT INTO procedure_profiles (procedure_id, profile_id)
SELECT p.id, t.id FROM procedures p CROSS JOIN treatment_profiles t ON CONFLICT DO NOTHING;
INSERT INTO procedure_contraindications (procedure_id, condition_id)
SELECT p.id, m.id FROM procedures p, medical_conditions m
WHERE p.name = 'Парафинолечение' AND m.code = 'HYPERTENSION' ON CONFLICT DO NOTHING;

SELECT 'users' t, count(*) FROM users UNION ALL SELECT 'user_roles', count(*) FROM user_roles
UNION ALL SELECT 'rooms', count(*) FROM rooms UNION ALL SELECT 'procedures', count(*) FROM procedures;

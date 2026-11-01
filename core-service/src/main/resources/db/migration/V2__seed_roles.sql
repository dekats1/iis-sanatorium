-- Справочник ролей (глава 1, раздел 1.1; глава 2, раздел 2.4). Код роли = authority ROLE_<code> в Spring Security.
INSERT INTO roles (code, name) VALUES
    ('CLIENT',        'Клиент (отдыхающий / туроператор)'),
    ('BOOKING_ADMIN', 'Администратор бронирования'),
    ('DOCTOR',        'Врач'),
    ('MANAGER',       'Менеджер по доходам'),
    ('SYSADMIN',      'Системный администратор');

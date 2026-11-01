-- Таблицы программы лояльности, электронной медкарты (EHR), склада расходников, персонала и пакетных туров

-- 1. Программа лояльности
CREATE TABLE loyalty_accounts (
    client_id    BIGINT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
    balance      INT NOT NULL DEFAULT 100,
    spent_money  NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bonus_transactions (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_id   BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    amount      INT NOT NULL,
    type        VARCHAR(32) NOT NULL CHECK (type IN ('WELCOME','EARN','REDEMPTION','ADJUSTMENT')),
    description VARCHAR(255) NOT NULL,
    voucher_id  BIGINT REFERENCES vouchers(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bonus_tx_client ON bonus_transactions(client_id, created_at DESC);

-- 2. Электронная медкарта (EHR)
CREATE TABLE ehr_records (
    client_id                BIGINT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
    sanatorium_card_number   VARCHAR(64),
    blood_type               VARCHAR(32),
    allergies                VARCHAR(255),
    chronic_diseases         VARCHAR(255),
    height_cm                INT,
    weight_kg                NUMERIC(5,1),
    blood_pressure_systolic  INT,
    blood_pressure_diastolic INT,
    pulse                    INT,
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE doctor_notes (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_id        BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    doctor_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    doctor_name      VARCHAR(120) NOT NULL,
    visit_type       VARCHAR(32) NOT NULL CHECK (visit_type IN ('INITIAL','CONTROL','DISCHARGE')),
    complaints       TEXT,
    objective_status TEXT,
    recommendations  TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_doctor_notes_client ON doctor_notes(client_id, created_at DESC);

-- 3. Склад расходных материалов
CREATE TABLE consumables (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sku                VARCHAR(64) UNIQUE NOT NULL,
    name               VARCHAR(255) NOT NULL,
    category           VARCHAR(120) NOT NULL,
    cabinet_id         INT REFERENCES cabinets(id) ON DELETE SET NULL,
    cabinet_name       VARCHAR(120),
    unit               VARCHAR(32) NOT NULL,
    stock_quantity     NUMERIC(10,2) NOT NULL DEFAULT 0,
    min_threshold      NUMERIC(10,2) NOT NULL DEFAULT 10,
    last_restocked_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_consumables_category ON consumables(category);

-- 4. Персонал и смены
CREATE TABLE staff_members (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name            VARCHAR(120) NOT NULL,
    role                 VARCHAR(120) NOT NULL,
    cabinet_name         VARCHAR(120),
    shift_hours          VARCHAR(64) NOT NULL,
    status               VARCHAR(32) NOT NULL DEFAULT 'ON_SHIFT' CHECK (status IN ('ON_SHIFT','BREAK','OFF_DUTY','VACATION')),
    assigned_slots_today INT NOT NULL DEFAULT 0,
    max_slots_per_day    INT NOT NULL DEFAULT 15,
    rating               NUMERIC(3,2) NOT NULL DEFAULT 4.90,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Пакетные предложения
CREATE TABLE sanatorium_packages (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    description     TEXT NOT NULL,
    category_id     INT REFERENCES room_categories(id) ON DELETE RESTRICT,
    category_name   VARCHAR(120) NOT NULL,
    profile_id      INT REFERENCES treatment_profiles(id) ON DELETE RESTRICT,
    profile_name    VARCHAR(120) NOT NULL,
    duration_nights INT NOT NULL,
    base_price      NUMERIC(12,2) NOT NULL,
    package_price   NUMERIC(12,2) NOT NULL,
    badge           VARCHAR(64),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

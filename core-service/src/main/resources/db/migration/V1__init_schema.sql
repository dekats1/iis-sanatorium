-- sanatorium_core: проектный DDL (глава 2). Проверен на PostgreSQL 16.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE roles (
    id   SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(30)  NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL
);
CREATE TABLE users (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(150) NOT NULL,
    email         VARCHAR(150) UNIQUE,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE TABLE user_roles (
    user_id BIGINT   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id SMALLINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE room_categories (
    id             SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name           VARCHAR(100) NOT NULL UNIQUE,
    capacity_total SMALLINT     NOT NULL CHECK (capacity_total > 0),
    description    TEXT
);
CREATE TABLE rooms (
    id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id SMALLINT    NOT NULL REFERENCES room_categories(id) ON DELETE RESTRICT,
    room_number VARCHAR(10) NOT NULL UNIQUE,
    floor       SMALLINT,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE TABLE treatment_profiles (
    id   SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(30)  NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL
);
CREATE TABLE cabinets (
    id            SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          VARCHAR(100) NOT NULL UNIQUE,
    slots_per_day SMALLINT     NOT NULL CHECK (slots_per_day > 0)
);
CREATE TABLE procedures (
    id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name         VARCHAR(150) NOT NULL UNIQUE,
    duration_min SMALLINT     NOT NULL CHECK (duration_min > 0),
    cabinet_id   SMALLINT     NOT NULL REFERENCES cabinets(id) ON DELETE RESTRICT
);
CREATE TABLE procedure_profiles (
    procedure_id INT      NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
    profile_id   SMALLINT NOT NULL REFERENCES treatment_profiles(id) ON DELETE CASCADE,
    PRIMARY KEY (procedure_id, profile_id)
);
CREATE TABLE medical_conditions (
    id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(30)  NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL
);
CREATE TABLE procedure_contraindications (
    procedure_id INT NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
    condition_id INT NOT NULL REFERENCES medical_conditions(id) ON DELETE CASCADE,
    PRIMARY KEY (procedure_id, condition_id)
);
CREATE TABLE diets (
    id   SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(30)  NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL
);
CREATE TABLE sales_channels (
    id             SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name           VARCHAR(100)  NOT NULL UNIQUE,
    commission_pct NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (commission_pct BETWEEN 0 AND 100),
    quota_places   INT CHECK (quota_places >= 0)
);
CREATE TABLE customers (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type        VARCHAR(10)  NOT NULL CHECK (type IN ('ORG','PERSON')),
    name        VARCHAR(200) NOT NULL,
    contract_no VARCHAR(50)
);
CREATE TABLE clients (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    last_name   VARCHAR(80) NOT NULL,
    first_name  VARCHAR(80) NOT NULL,
    middle_name VARCHAR(80),
    birth_date  DATE        NOT NULL,
    phone       VARCHAR(30),
    email       VARCHAR(150),
    citizenship VARCHAR(60)
);
CREATE TABLE client_conditions (
    client_id    BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    condition_id INT    NOT NULL REFERENCES medical_conditions(id) ON DELETE RESTRICT,
    diagnosed_at DATE,
    PRIMARY KEY (client_id, condition_id)
);

CREATE TABLE vouchers (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_id           BIGINT   NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    customer_id         BIGINT   REFERENCES customers(id) ON DELETE RESTRICT,
    channel_id          SMALLINT NOT NULL REFERENCES sales_channels(id) ON DELETE RESTRICT,
    profile_id          SMALLINT NOT NULL REFERENCES treatment_profiles(id) ON DELETE RESTRICT,
    diet_id             SMALLINT REFERENCES diets(id) ON DELETE RESTRICT,
    created_by          BIGINT   NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','AWAITING_PAYMENT','CONFIRMED','CHECKED_IN','COMPLETED','CANCELLED','EXPIRED')),
    quote_id            UUID UNIQUE,
    price_per_place_day NUMERIC(10,2) NOT NULL CHECK (price_per_place_day >= 0),
    total_price         NUMERIC(12,2) NOT NULL CHECK (total_price >= 0),
    currency            CHAR(3) NOT NULL DEFAULT 'BYN',
    payment_deadline    TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vouchers_client ON vouchers(client_id);
CREATE INDEX idx_vouchers_status ON vouchers(status);

CREATE TABLE bookings (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    voucher_id    BIGINT NOT NULL REFERENCES vouchers(id) ON DELETE RESTRICT,
    room_id       INT    NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
    check_in      DATE   NOT NULL,
    check_out     DATE   NOT NULL,
    places_count  SMALLINT NOT NULL CHECK (places_count > 0),
    status        VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE','CONFIRMED','CHECKED_IN','COMPLETED','CANCELLED')),
    CONSTRAINT bookings_dates_ck CHECK (check_out > check_in),
    CONSTRAINT bookings_id_room_uk UNIQUE (id, room_id)
);
CREATE INDEX idx_bookings_voucher ON bookings(voucher_id);
CREATE INDEX idx_bookings_dates ON bookings USING gist (daterange(check_in, check_out, '[)'));

CREATE TABLE booking_places (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id BIGINT    NOT NULL,
    room_id    INT       NOT NULL,
    place_no   SMALLINT  NOT NULL CHECK (place_no > 0),
    stay_range DATERANGE NOT NULL,
    is_active  BOOLEAN   NOT NULL DEFAULT TRUE,
    CONSTRAINT bp_range_ck CHECK (NOT isempty(stay_range) AND NOT lower_inf(stay_range) AND NOT upper_inf(stay_range)),
    CONSTRAINT bp_booking_fk FOREIGN KEY (booking_id, room_id)
        REFERENCES bookings (id, room_id) ON DELETE CASCADE,
    CONSTRAINT bp_no_overlap EXCLUDE USING gist
        (room_id WITH =, place_no WITH =, stay_range WITH &&) WHERE (is_active)
);

-- место должно существовать в номере: place_no <= capacity_total категории
CREATE FUNCTION trg_bp_check_place_no() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cap SMALLINT;
BEGIN
    SELECT rc.capacity_total INTO cap
      FROM rooms r JOIN room_categories rc ON rc.id = r.category_id
     WHERE r.id = NEW.room_id;
    IF NEW.place_no > cap THEN
        RAISE EXCEPTION 'place_no % превышает вместимость номера % (%)', NEW.place_no, NEW.room_id, cap
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER bp_check_place_no BEFORE INSERT OR UPDATE OF place_no, room_id ON booking_places
    FOR EACH ROW EXECUTE FUNCTION trg_bp_check_place_no();

-- is_active = (status <> 'CANCELLED'): синхронизация при смене статуса брони
CREATE FUNCTION trg_bookings_sync_active() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE booking_places SET is_active = (NEW.status <> 'CANCELLED') WHERE booking_id = NEW.id;
    RETURN NEW;
END $$;
CREATE TRIGGER bookings_sync_active AFTER UPDATE OF status ON bookings
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION trg_bookings_sync_active();

CREATE TABLE waitlist (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_id   BIGINT   NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    category_id SMALLINT NOT NULL REFERENCES room_categories(id) ON DELETE CASCADE,
    date_from   DATE     NOT NULL,
    date_to     DATE     NOT NULL,
    places      SMALLINT NOT NULL CHECK (places > 0),
    status      VARCHAR(10) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','NOTIFIED','CLOSED')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (date_to > date_from)
);
CREATE TABLE payments (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    voucher_id  BIGINT NOT NULL REFERENCES vouchers(id) ON DELETE RESTRICT,
    kind        VARCHAR(10) NOT NULL CHECK (kind IN ('PREPAY','REFUND')),
    amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    status      VARCHAR(10) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SUCCESS','DECLINED')),
    invoice_id  BIGINT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_voucher ON payments(voucher_id);
CREATE TABLE price_snapshot (
    category_id SMALLINT NOT NULL REFERENCES room_categories(id) ON DELETE CASCADE,
    stay_date   DATE     NOT NULL,
    price       NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (category_id, stay_date)
);

CREATE TABLE treatment_assignments (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    voucher_id BIGINT NOT NULL REFERENCES vouchers(id) ON DELETE RESTRICT,
    doctor_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE assignment_procedures (
    assignment_id    BIGINT NOT NULL REFERENCES treatment_assignments(id) ON DELETE CASCADE,
    procedure_id     INT    NOT NULL REFERENCES procedures(id) ON DELETE RESTRICT,
    sessions_planned SMALLINT NOT NULL CHECK (sessions_planned > 0),
    PRIMARY KEY (assignment_id, procedure_id)
);
CREATE TABLE procedure_schedule (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    assignment_id BIGINT NOT NULL,
    procedure_id  INT    NOT NULL,
    slot_dt       TIMESTAMPTZ NOT NULL,
    done          BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT ps_assignment_fk FOREIGN KEY (assignment_id, procedure_id)
        REFERENCES assignment_procedures (assignment_id, procedure_id) ON DELETE CASCADE,
    CONSTRAINT ps_slot_uk UNIQUE (assignment_id, procedure_id, slot_dt)
);
CREATE INDEX idx_schedule_slot ON procedure_schedule(slot_dt);
CREATE TABLE audit_log (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action     VARCHAR(50)  NOT NULL,
    entity     VARCHAR(50)  NOT NULL,
    entity_id  VARCHAR(50),
    details    TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

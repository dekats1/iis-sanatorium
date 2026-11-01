-- sanatorium_payment: проектный DDL (глава 2). Проверен на PostgreSQL 16.
CREATE TABLE invoices (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    voucher_id   BIGINT NOT NULL,
    amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    currency     CHAR(3) NOT NULL DEFAULT 'BYN',
    callback_url VARCHAR(500) NOT NULL,
    status       VARCHAR(10) NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED','SUCCESS','DECLINED')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

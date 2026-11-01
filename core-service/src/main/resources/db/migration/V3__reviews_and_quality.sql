-- Таблицы отзывов гостей и контроля качества медицинских процедур (NPS)

CREATE TABLE guest_reviews (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    voucher_id       BIGINT UNIQUE,
    client_id        BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    client_name      VARCHAR(120) NOT NULL,
    category_name    VARCHAR(100) NOT NULL,
    room_number      VARCHAR(32),
    stay_dates       VARCHAR(120) NOT NULL,
    overall_rating   INT NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
    nps_score        INT NOT NULL CHECK (nps_score >= 0 AND nps_score <= 10),
    room_rating      INT NOT NULL CHECK (room_rating >= 1 AND room_rating <= 5),
    treatment_rating INT NOT NULL CHECK (treatment_rating >= 1 AND treatment_rating <= 5),
    food_rating      INT NOT NULL CHECK (food_rating >= 1 AND food_rating <= 5),
    service_rating   INT NOT NULL CHECK (service_rating >= 1 AND service_rating <= 5),
    comment          TEXT NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('PUBLISHED', 'PENDING', 'REJECTED')),
    reply_text       TEXT,
    replied_at       TIMESTAMPTZ,
    replier_name     VARCHAR(120),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_guest_reviews_client ON guest_reviews(client_id);
CREATE INDEX idx_guest_reviews_created ON guest_reviews(created_at DESC);
CREATE INDEX idx_guest_reviews_status ON guest_reviews(status);
CREATE INDEX idx_guest_reviews_overall ON guest_reviews(overall_rating);

CREATE TABLE procedure_feedback (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    review_id      BIGINT NOT NULL REFERENCES guest_reviews(id) ON DELETE CASCADE,
    procedure_name VARCHAR(120) NOT NULL,
    rating         INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment        TEXT
);

CREATE INDEX idx_procedure_feedback_review ON procedure_feedback(review_id);
CREATE INDEX idx_procedure_feedback_proc ON procedure_feedback(procedure_name);

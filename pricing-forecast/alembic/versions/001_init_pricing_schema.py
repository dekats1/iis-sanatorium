"""Начальная схема sanatorium_pricing (зеркало ch2/sql/schema_pricing.sql, раздел 2.3 главы 2).

Revision ID: 0001
Revises:
Create Date: 2026-10-16

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")

    op.create_table(
        "season_periods",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("date_from", sa.Date(), nullable=False),
        sa.Column("date_to", sa.Date(), nullable=False),
        sa.Column("k_season", sa.Numeric(4, 2), nullable=False),
        sa.CheckConstraint("k_season > 0", name="season_periods_k_season_ck"),
        sa.CheckConstraint("date_from <= date_to", name="season_periods_dates_ck"),
    )
    # Сезоны не должны пересекаться по датам — EXCLUDE USING gist (глава 2, раздел 2.3)
    op.execute(
        "ALTER TABLE season_periods ADD CONSTRAINT season_periods_no_overlap "
        "EXCLUDE USING gist (daterange(date_from, date_to, '[]') WITH &&)"
    )

    op.create_table(
        "tariffs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("season_id", sa.Integer(), sa.ForeignKey("season_periods.id"), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("price_base", sa.Numeric(10, 2), nullable=False),
        sa.UniqueConstraint("category_id", "season_id", name="tariffs_category_season_uq"),
        sa.CheckConstraint("price_base > 0", name="tariffs_price_base_ck"),
    )

    op.create_table(
        "price_rules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("date_from", sa.Date(), nullable=False),
        sa.Column("date_to", sa.Date(), nullable=False),
        sa.Column("p_min", sa.Numeric(10, 2), nullable=False),
        sa.Column("p_max", sa.Numeric(10, 2), nullable=False),
        sa.Column("min_los", sa.SmallInteger(), nullable=False, server_default="1"),
        sa.Column("closed", sa.Boolean(), nullable=False, server_default="false"),
        sa.CheckConstraint("p_min <= p_max", name="price_rules_bounds_ck"),
        sa.CheckConstraint("p_min > 0", name="price_rules_p_min_positive_ck"),
    )
    # Коридоры одной категории не должны пересекаться по датам (раздел 2.3 главы 2)
    op.execute(
        "ALTER TABLE price_rules ADD CONSTRAINT price_rules_no_overlap_per_category "
        "EXCLUDE USING gist (category_id WITH =, daterange(date_from, date_to, '[]') WITH &&)"
    )

    op.create_table(
        "demand_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("stay_date", sa.Date(), nullable=False),
        sa.Column("sold", sa.Integer(), nullable=False),
        sa.Column("available", sa.Integer(), nullable=False),
        sa.UniqueConstraint("category_id", "stay_date", name="demand_history_category_date_uq"),
        sa.CheckConstraint("sold >= 0 AND available > 0 AND sold <= available", name="demand_history_bounds_ck"),
    )

    op.create_table(
        "forecast_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("model", sa.String(50), nullable=False),
        sa.Column("mape", sa.Numeric(6, 2), nullable=True),
        sa.Column("baseline_mape", sa.Numeric(6, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "forecasts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("run_id", sa.Integer(), sa.ForeignKey("forecast_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("stay_date", sa.Date(), nullable=False),
        sa.Column("predicted_occ", sa.Numeric(5, 2), nullable=False),
        sa.UniqueConstraint("run_id", "category_id", "stay_date", name="forecasts_run_category_date_uq"),
        sa.CheckConstraint("predicted_occ BETWEEN 0 AND 100", name="forecasts_predicted_occ_ck"),
    )

    op.create_table(
        "price_reviews",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("quote_id", postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("stay_date", sa.Date(), nullable=False),
        sa.Column("price_recommended", sa.Numeric(10, 2), nullable=False),
        sa.Column("price_applied", sa.Numeric(10, 2), nullable=False),
        sa.Column("p_min", sa.Numeric(10, 2), nullable=False),
        sa.Column("p_max", sa.Numeric(10, 2), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING_REVIEW"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("decided_by", sa.String(50), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('PENDING_REVIEW','ACKNOWLEDGED','RULE_ADJUSTED','AUTO_ACKNOWLEDGED')",
            name="price_reviews_status_ck",
        ),
    )
    op.create_index("ix_price_reviews_status", "price_reviews", ["status"])

    op.create_table(
        "processed_events",
        sa.Column("message_id", sa.String(100), primary_key=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("processed_events")
    op.drop_table("price_reviews")
    op.drop_table("forecasts")
    op.drop_table("forecast_runs")
    op.drop_table("demand_history")
    op.execute("ALTER TABLE price_rules DROP CONSTRAINT IF EXISTS price_rules_no_overlap_per_category")
    op.drop_table("price_rules")
    op.drop_table("tariffs")
    op.execute("ALTER TABLE season_periods DROP CONSTRAINT IF EXISTS season_periods_no_overlap")
    op.drop_table("season_periods")

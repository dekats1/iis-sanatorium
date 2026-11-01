"""Модульные тесты прогноза загрузки (pricing/forecaster.py).

Проверяют корректность годового индекса (последовательная мультипликативная
декомпозиция без двойного учёта праздников) и то, что forecast_occupancy
возвращает прогноз нужной длины в допустимом диапазоне [0;100] (НФТ-07).
"""
from __future__ import annotations

import datetime as dt

import numpy as np
import pandas as pd
import pytest

from pricing_forecast.pricing.forecaster import _occupancy_series, _year_index, forecast_occupancy


def _synthetic_history(days: int = 400, seed: int = 7) -> pd.DataFrame:
    """Синтетическая история с недельной и годовой сезонностью (как в cli.py seed)."""
    rng = np.random.default_rng(seed)
    start = dt.date(2025, 1, 1)
    rows = []
    for i in range(days):
        day = start + dt.timedelta(days=i)
        month_k = {
            1: 0.5, 2: 0.5, 3: 0.6, 4: 0.65, 5: 0.7, 6: 0.85,
            7: 0.95, 8: 0.95, 9: 0.75, 10: 0.65, 11: 0.55, 12: 0.6,
        }[day.month]
        weekday_k = 1.1 if day.weekday() >= 5 else 0.95  # выходные чуть выше
        noise = rng.uniform(-0.05, 0.05)
        occ = max(0.05, min(0.99, month_k * weekday_k + noise))
        available = 20
        rows.append({"stay_date": day, "sold": round(occ * available), "available": available})
    return pd.DataFrame(rows)


class TestOccupancySeries:
    def test_produces_continuous_daily_index(self):
        history = _synthetic_history(days=60)
        occ = _occupancy_series(history)
        assert len(occ) == 60
        assert occ.index.freqstr == "D"

    def test_values_are_percentages(self):
        history = _synthetic_history(days=60)
        occ = _occupancy_series(history)
        assert occ.min() >= 0
        assert occ.max() <= 100


class TestYearIndex:
    def test_index_has_same_length_as_series(self):
        history = _synthetic_history(days=400)
        occ = _occupancy_series(history)
        idx = _year_index(occ)
        assert len(idx) == len(occ)

    def test_index_is_centered_around_one(self):
        # Индекс строится как отношение к среднему, значит его собственное среднее
        # по построению должно быть близко к 1 (без учёта праздничной надбавки).
        history = _synthetic_history(days=400)
        occ = _occupancy_series(history)
        idx = _year_index(occ)
        assert 0.8 <= idx.mean() <= 1.2

    def test_holiday_does_not_double_count_peak_month(self):
        # Праздник 1 мая попадает в май (уже входит в сезонную надбавку через idx_month);
        # на ОСТАТКЕ его отдельная надбавка должна быть небольшой, а не дублировать весь
        # майский эффект — это и есть защита от двойного учёта (докстринг forecast.py).
        history = _synthetic_history(days=730)
        occ = _occupancy_series(history)
        idx = _year_index(occ)
        may_day = [d for d in idx.index if (d.month, d.day) == (5, 1)]
        assert may_day  # дата присутствует в двухлетнем ряду
        # Праздничная надбавка в этой синтетической выборке (без искусственного всплеска
        # именно на 1 мая) не должна давать выброс в разы — иначе был бы двойной учёт
        assert 0.5 <= idx.loc[may_day[0]] <= 2.0


class TestForecastOccupancy:
    def test_returns_requested_horizon_length(self):
        history = _synthetic_history(days=400)
        points, mape = forecast_occupancy(history, horizon_days=30, seasonal_periods=7)
        assert len(points) == 30

    def test_predicted_occ_within_valid_range(self):
        history = _synthetic_history(days=400)
        points, _mape = forecast_occupancy(history, horizon_days=90, seasonal_periods=7)
        for p in points:
            assert 0.0 <= p.predicted_occ <= 100.0

    def test_dates_are_sequential_and_continue_history(self):
        history = _synthetic_history(days=400)
        points, _mape = forecast_occupancy(history, horizon_days=10, seasonal_periods=7)
        last_history_date = history["stay_date"].max()
        assert points[0].stay_date == last_history_date + dt.timedelta(days=1)
        for a, b in zip(points, points[1:]):
            assert b.stay_date == a.stay_date + dt.timedelta(days=1)

    def test_mape_is_a_finite_nonnegative_percentage_when_holdout_exists(self):
        history = _synthetic_history(days=400)
        _points, mape = forecast_occupancy(history, horizon_days=30, seasonal_periods=7)
        assert mape == mape  # not NaN
        assert mape >= 0

    def test_minimum_history_still_produces_a_forecast(self):
        # api/forecast.py требует >= 28 суток перед вызовом; здесь проверяем,
        # что сама функция не падает на границе этого минимума.
        history = _synthetic_history(days=28)
        points, _mape = forecast_occupancy(history, horizon_days=7, seasonal_periods=7)
        assert len(points) == 7

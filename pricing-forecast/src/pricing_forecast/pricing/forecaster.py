"""Прогноз загрузки по категориям номеров (ФТ-15).

Метод: Holt-Winters (аддитивный тренд, мультипликативная недельная сезонность,
seasonal_periods=7) поверх ряда, ОЧИЩЕННОГО от годовой сезонности делением
(а не вычитанием) на годовой индекс. Коэффициент сезона k_season в прогнозе
не участвует: он отвечает только за цену (см. engine.py), а не за ожидаемую
заполняемость, которая оценивается по фактической истории продаж.

Годовой индекс считается последовательно, без двойного учёта:
  1) idx_month  — средняя занятость месяца / средняя занятость года;
  2) остаток    occ_resid = occ / idx_month;
  3) idx_holiday — на ОСТАТКЕ ищется надбавка/скидка праздничных дат
     (иначе праздник, выпавший на пиковый месяц, учитывался бы дважды).
  4) idx_year = idx_month * idx_holiday (индексы перемножаются, не складываются).

cleaned = occ / idx_year  -> подаётся в Holt-Winters
forecast = clip(HW(cleaned) * idx_year, 0, 100)
"""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

import numpy as np
import pandas as pd
from statsmodels.tsa.holtwinters import ExponentialSmoothing

HOLIDAY_DATES_BY: set[tuple[int, int]] = {
    (1, 1), (1, 2), (1, 7), (3, 8), (5, 1), (5, 9), (7, 3), (11, 7), (12, 25),
}  # государственные праздники РБ (месяц, день) — проектный справочник, без переноса выходных


@dataclass(frozen=True)
class ForecastPoint:
    stay_date: dt.date
    predicted_occ: float


def _occupancy_series(history: pd.DataFrame) -> pd.Series:
    """history: колонки stay_date, sold, available -> Occ% по дням, непрерывный индекс."""
    s = history.set_index("stay_date")["sold"] / history.set_index("stay_date")["available"] * 100.0
    s.index = pd.DatetimeIndex(s.index)
    full_idx = pd.date_range(s.index.min(), s.index.max(), freq="D")
    return s.reindex(full_idx).interpolate(limit_direction="both")


def _year_index(occ: pd.Series) -> pd.Series:
    by_month = occ.groupby(occ.index.month).mean()
    idx_month = occ.index.month.map(by_month) / by_month.mean()
    idx_month = pd.Series(idx_month, index=occ.index)

    resid = occ / idx_month
    is_holiday = pd.Series(
        [(d.month, d.day) in HOLIDAY_DATES_BY for d in occ.index], index=occ.index
    )
    holiday_mean = resid[is_holiday].mean() if is_holiday.any() else resid.mean()
    ordinary_mean = resid[~is_holiday].mean() if (~is_holiday).any() else resid.mean()
    idx_holiday = pd.Series(np.where(is_holiday, holiday_mean / ordinary_mean, 1.0), index=occ.index)

    return idx_month * idx_holiday


def forecast_occupancy(
    history: pd.DataFrame, horizon_days: int, seasonal_periods: int = 7
) -> tuple[list[ForecastPoint], float]:
    """Возвращает прогноз на horizon_days суток вперёд и MAPE модели на отложенных 14 сутках.

    history должна содержать минимум 2 * seasonal_periods + 14 точек подряд,
    иначе Holt-Winters не сможет оценить сезонную компоненту — в этом случае
    вызывающий код (api/forecast.py) обязан вернуть 422 с понятным сообщением
    (НФТ-05: обработка ошибок), а не упасть с исключением statsmodels.
    """
    occ = _occupancy_series(history)
    idx_year = _year_index(occ)
    cleaned = (occ / idx_year).clip(lower=1e-3)

    holdout = min(14, max(0, len(cleaned) // 5))
    train, test = (cleaned.iloc[:-holdout], cleaned.iloc[-holdout:]) if holdout else (cleaned, None)

    model = ExponentialSmoothing(
        train, trend="add", seasonal="mul", seasonal_periods=seasonal_periods,
        initialization_method="estimated",
    ).fit(optimized=True)

    mape = float("nan")
    if test is not None and len(test):
        pred_test = model.forecast(len(test))
        idx_test = idx_year.reindex(test.index)
        actual = (test * idx_test).clip(0, 100)
        predicted = (pred_test.values * idx_test.values)
        baseline = occ.shift(seasonal_periods).reindex(test.index)  # сезонный наивный прогноз
        mape = float(np.mean(np.abs((actual.values - predicted) / np.maximum(actual.values, 1e-3))) * 100)
        _ = baseline  # baseline_mape считается отдельно в api/forecast.py для отчёта (таблица 2.9/Q7)

    full_fit = ExponentialSmoothing(
        cleaned, trend="add", seasonal="mul", seasonal_periods=seasonal_periods,
        initialization_method="estimated",
    ).fit(optimized=True)
    future_cleaned = full_fit.forecast(horizon_days)

    future_dates = pd.date_range(occ.index[-1] + pd.Timedelta(days=1), periods=horizon_days, freq="D")
    future_idx_year = pd.Series(idx_year.values[-min(len(idx_year), 365):], index=None)
    # годовой индекс на будущие даты берём из того же дня прошлого года (с запасом за счёт cycle)
    anchor = {(d.month, d.day): v for d, v in idx_year.items()}
    future_idx = pd.Series(
        [anchor.get((d.month, d.day), 1.0) for d in future_dates], index=future_dates
    )

    predicted = (future_cleaned.values * future_idx.values)
    predicted = np.clip(predicted, 0, 100)

    points = [
        ForecastPoint(stay_date=d.date(), predicted_occ=round(float(v), 2))
        for d, v in zip(future_dates, predicted)
    ]
    return points, mape

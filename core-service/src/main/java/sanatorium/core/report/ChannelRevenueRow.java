package sanatorium.core.report;

import java.math.BigDecimal;

/** Выручка канала продаж до расчёта комиссии. revenue = null, если у канала нет оплаченных путёвок. */
public record ChannelRevenueRow(String channel, Long vouchers, BigDecimal revenue, BigDecimal commissionPct) { }

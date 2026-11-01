package sanatorium.core.pricingclient;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/** Цена на одни сутки. fallback=true — цена взята из резервного снимка price_snapshot (принцип 4, раздел 2.1). */
public record QuotedLine(int categoryId, LocalDate stayDate, BigDecimal price, boolean outOfCorridor,
                         UUID quoteId, boolean fallback) { }

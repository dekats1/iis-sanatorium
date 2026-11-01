package sanatorium.core.report;

import java.math.BigDecimal;

public record ProfilePopularityRow(Integer profileId, String profileName, Long vouchersCount, BigDecimal revenue) {
}

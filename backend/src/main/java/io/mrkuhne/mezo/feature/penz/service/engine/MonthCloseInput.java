package io.mrkuhne.mezo.feature.penz.service.engine;

import java.time.YearMonth;

/** The engine's view of a closed month (old {@code MonthClose}, only what the rules read). */
public record MonthCloseInput(YearMonth month, long deficitMinor) {
}

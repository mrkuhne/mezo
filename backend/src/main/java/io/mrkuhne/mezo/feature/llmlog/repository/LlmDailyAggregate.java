package io.mrkuhne.mezo.feature.llmlog.repository;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Egy naptári nap rollupja az {@code llm_log_history} felett — a memória-obszervatórium Audit
 * nézete olvassa (mezo-al1i). A {@code costUsd} null marad, ha aznap egyetlen beárazott sor sincs
 * (ismeretlen ≠ nulla — a {@link LlmUsageAggregate} elve).
 */
public interface LlmDailyAggregate {

    LocalDate getDay();

    long getCalls();

    long getInputTokens();

    long getOutputTokens();

    BigDecimal getCostUsd();
}

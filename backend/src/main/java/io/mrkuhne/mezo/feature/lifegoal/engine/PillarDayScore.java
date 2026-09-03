package io.mrkuhne.mezo.feature.lifegoal.engine;

import java.math.BigDecimal;

/** Egy pillér-nap kiszámolt eredménye. status ∈ hit|partial|miss|no_data (string, a DB-oszlop szótára). */
public record PillarDayScore(String status, BigDecimal value, BigDecimal target, BigDecimal baseline) {}

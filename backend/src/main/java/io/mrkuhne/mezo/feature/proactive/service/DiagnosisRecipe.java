package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEntity;
import java.util.List;

/**
 * One diagnosis phenomenon's recipe (mezo-po3y) — everything phenomenon-specific in one record,
 * so a THIRD question is a new entry here plus a ck-constraint migration, nothing else. The
 * extraction rule that produced {@code LogFreshnessProbe} applied again: the second instance
 * pays for the seam.
 *
 * @param phenomenon  the {@code DiagnosisEntity.PHENOMENON_*} constant — the wire + ck value.
 * @param labelHu     the payload's JELENSÉG line.
 * @param questionHu  the prompt's question sentence — what Daniel is asking.
 * @param metrics     the fatigue/sleep-relevant {@link MetricKey} subset, FIXED enum-order
 *                    slices of the catalog: the index into the rendered candidate list is the
 *                    model's answer contract, so reordering is a breaking change.
 */
public record DiagnosisRecipe(
        String phenomenon, String labelHu, String questionHu, List<MetricKey> metrics) {

    public static final DiagnosisRecipe FATIGUE = new DiagnosisRecipe(
            DiagnosisEntity.PHENOMENON_FATIGUE,
            "fáradtság",
            "Daniel azt kérdezi: miért fáradt?",
            List.of(
                    MetricKey.SLEEP_DURATION_H,
                    MetricKey.SLEEP_QUALITY,
                    MetricKey.SLEEP_AWAKENINGS,
                    MetricKey.BEDTIME_HOUR,
                    MetricKey.BEDTIME_VARIABILITY,
                    MetricKey.CHECKIN_ENERGY,
                    MetricKey.CHECKIN_STRESS,
                    MetricKey.CHECKIN_MENTAL,
                    MetricKey.CHECKIN_BODY,
                    MetricKey.DAILY_KCAL,
                    MetricKey.DAILY_PROTEIN_G,
                    MetricKey.DAILY_WATER_ML,
                    MetricKey.LATE_MEAL_HOUR,
                    MetricKey.TRAINING_RPE,
                    MetricKey.GYM_VOLUME_KG,
                    MetricKey.SPORT_LOAD_MIN,
                    MetricKey.ACWR,
                    MetricKey.TRAINING_MONOTONY,
                    MetricKey.MEDICATION_CYCLE_DAY));

    /** Sleep-as-outcome: the sleep metrics are the phenomenon's own state; the suspects come
     *  from the behavioral side — late meals, stress, load, bedtime discipline, medication. */
    public static final DiagnosisRecipe SLEEP = new DiagnosisRecipe(
            DiagnosisEntity.PHENOMENON_SLEEP,
            "rossz alvás",
            "Daniel azt kérdezi: miért alszik rosszul?",
            List.of(
                    MetricKey.SLEEP_QUALITY,
                    MetricKey.SLEEP_DURATION_H,
                    MetricKey.SLEEP_AWAKENINGS,
                    MetricKey.BEDTIME_HOUR,
                    MetricKey.BEDTIME_VARIABILITY,
                    MetricKey.WAKEUP_HOUR,
                    MetricKey.CHECKIN_STRESS,
                    MetricKey.CHECKIN_MENTAL,
                    MetricKey.LATE_MEAL_HOUR,
                    MetricKey.DAILY_WATER_ML,
                    MetricKey.TRAINING_RPE,
                    MetricKey.GYM_VOLUME_KG,
                    MetricKey.SPORT_LOAD_MIN,
                    MetricKey.ACWR,
                    MetricKey.TRAINING_MONOTONY,
                    MetricKey.MEDICATION_CYCLE_DAY));

    /** The wire value → recipe; null for an unknown phenomenon (the caller 400s upstream). */
    public static DiagnosisRecipe byPhenomenon(String phenomenon) {
        if (FATIGUE.phenomenon().equals(phenomenon)) return FATIGUE;
        if (SLEEP.phenomenon().equals(phenomenon)) return SLEEP;
        return null;
    }
}

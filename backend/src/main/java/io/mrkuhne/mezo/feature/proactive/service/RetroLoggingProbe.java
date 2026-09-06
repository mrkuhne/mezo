package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Round 2 S3 (bd mezo-d58h.7.3, spec 2026-09-05 §b/§9): "does this user WRITE the day, or
 * RECONSTRUCT it later?" — the detection behind the batch-logger prompt fact. The
 * {@link LogFreshnessProbe} / {@link HydrationShortfallProbe} idiom: a deterministic, separately
 * testable read that the generator only renders.
 *
 * <p>The threshold is not on the user's behaviour but on OUR confidence. Above it, "ma még nincs
 * naplózva semmi" stops being evidence of anything at all, and the companion must be told so
 * explicitly — otherwise the midday note reads an empty half-day as "nem evett", which is round
 * 2's central firing-policy error (spec §Decisions: unlogged ≠ compliant ≠ violating).
 *
 * <p><b>The window ends YESTERDAY.</b> Today is half-finished by construction: a meal about today
 * can only ever be same-day <i>so far</i>, and every meal the batch logger has not written yet is
 * simply absent. Including today would therefore drag the ratio DOWN for exactly the user this
 * rule is about. Today is read separately and only as state ({@code mealsLoggedToday}), never as
 * an input to the ratio.
 *
 * <p>Same calendar day ⇒ immediate: the diary-research convention this borrows from
 * {@code RetroLoggingRatioDetector} (character). The detector itself is deliberately NOT reused —
 * it splits event/reflection genres into a dossier claim with its own window and vocabulary,
 * whereas this slice needs one number for one prompt.
 *
 * <p>PRE-logging counts as retro: a meal written the evening before the day it is about also has
 * {@code created_at}'s day ≠ {@code meal_date}. That is still "not written in the moment", which
 * is all the fact claims.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class RetroLoggingProbe {

    /** {@code retroPct} is the rounded percentage of window meals written on another calendar day;
     *  {@code mealsLoggedToday} is TODAY's state, deliberately outside the ratio. */
    public record BatchLogging(
            int windowDays, int totalMeals, int retroMeals, int retroPct, int mealsLoggedToday) {}

    private final ProactiveProperties properties;
    private final MealRepository mealRepository;

    /** Empty whenever the honest answer is "not enough to say anything" — see the gates inline. */
    @Transactional(readOnly = true)
    public Optional<BatchLogging> evaluate(UUID userId, LocalDate date) {
        ProactiveProperties.RetroLogging cfg = properties.retroLogging();
        List<MealEntity> window = mealRepository
                .findByCreatedByAndDeletedFalseAndMealDateBetweenOrderByMealDateAsc(
                        userId, date.minusDays(cfg.windowDays()), date.minusDays(1));
        int total = window.size();
        if (total < cfg.minMeals()) {
            // Too little data is not a habit (spec §Decisions: too little data ⇒ silence).
            return Optional.empty();
        }
        int retro = (int) window.stream().filter(RetroLoggingProbe::isRetro).count();
        int retroPct = (int) Math.round(retro * 100.0 / total);
        if (retroPct < cfg.retroPct()) {
            return Optional.empty();
        }
        int today = mealRepository
                .findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(userId, date).size();
        return Optional.of(new BatchLogging(cfg.windowDays(), total, retro, retroPct, today));
    }

    /** Wall-clock convention (the {@code LateEatingRule} / {@link HydrationShortfallProbe}
     *  precedent): the server zone, no UTC conversion games. A row with no {@code created_at} is
     *  not yet flushed and cannot be judged — count it as immediate, the conservative direction. */
    private static boolean isRetro(MealEntity meal) {
        if (meal.getCreatedAt() == null || meal.getMealDate() == null) {
            return false;
        }
        return !LocalDate.ofInstant(meal.getCreatedAt(), ZoneId.systemDefault())
                .equals(meal.getMealDate());
    }
}

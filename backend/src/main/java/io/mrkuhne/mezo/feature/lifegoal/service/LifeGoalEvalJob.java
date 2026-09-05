package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Nightly life-goal evaluation cron (mezo-iizd.6, HabitJob pattern): rewrites the last 3 closed
 * days of every ACTIVE goal's pillars and grants pillar-hit XP. The rolling 3-day window is what
 * backfills late logging (spec §2, Exist.io); the whole pass is idempotent, so a double run (or a
 * manual evaluate in between) changes nothing. Failures are isolated per goal — one broken signal
 * source must not cost every other user their evaluation.
 *
 * <p>Isolation is two-layered, but only one layer is exercised by a test: the inner per-goal catch
 * is covered by {@code LifeGoalEvalJobIT}'s isolation test (a pillar with an unknown activity
 * {@code measure}). The outer per-user catch, guarding the goal-list fetch itself, is
 * defense-in-depth only — no no-mock seam can make that plain JPA query throw, and the house rules
 * forbid mocks in integration tests.
 *
 * <p>Beyond the pillar days and XP, this run is also where the DELAYED ha–akkor plans (and the
 * gap-based {@code ritual_missed}) fire for the SAME three closed days the pillar pass rewrites
 * (yesterday, -2, -3) — there is no separate scheduler for them (mezo-iizd.7, spec D-3), and the
 * rolling window is what lets late logging still earn its delayed nudge. Re-running is safe: the
 * plan dedup key is per-day.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.LIFEGOAL_SWITCH, FeaturesConfiguration.LIFE_GOAL_EVAL_JOB_SWITCH},
        havingValue = "true")
public class LifeGoalEvalJob {

    private final AppUserRepository appUserRepository;
    private final LifeGoalRepository goalRepository;
    private final LifeGoalProgressService progressService;
    private final LifeGoalTriggerService triggerService;

    @Scheduled(cron = "${mezo.lifegoal.eval-cron}")
    public void runEval() {
        LocalDate today = LocalDate.now();
        int goals = 0;
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                for (LifeGoalEntity goal
                        : goalRepository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(user.getId())) {
                    if (!LifeGoalEntity.STATUS_ACTIVE.equals(goal.getStatus())) {
                        continue;
                    }
                    try {
                        progressService.evaluateDays(user.getId(), goal);
                        // A záró log a SIKERESEN kiértékelt célokat számolja, ezért a számláló
                        // közvetlenül az evaluateDays után nő: egy trigger-hiba nem teheti
                        // alul-jelentetté azt a célt, aminek a pillér-napjai már megíródtak.
                        goals++;
                        // A késleltetett („másnap reggel") ha–akkor tervek + a hiány-alapú
                        // ritual_missed itt szólalnak meg, a három lezárt napra (spec D-3) —
                        // külön ütemező nincs. A cél-szintű catch ezt is izolálja.
                        triggerService.fireDelayed(user.getId(), goal, today);
                    } catch (Exception e) {
                        log.warn("Life-goal evaluation failed for goal {} (user {}) on {}",
                            goal.getId(), user.getId(), today, e);
                    }
                }
            } catch (Exception e) {
                log.warn("Life-goal evaluation failed for user {} on {}", user.getId(), today, e);
            }
        }
        log.info("Life-goal evaluation run for {} complete — {} active goal(s)", today, goals);
    }
}

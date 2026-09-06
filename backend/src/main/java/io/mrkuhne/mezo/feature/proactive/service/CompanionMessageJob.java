package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Companion-feed crons (spec §3): dawn morning generation + the midday nudge + evening closing
 * windows (the PredictionJob multi-methods-one-switch idiom). The sleep reaction is DELIBERATELY
 * not fired here (mezo-qn3z): it is an event-kind, born only from {@code SleepLogSavedEvent} via
 * {@link CompanionMessageEventListener}. Usually at 05:45 tonight's sleep is not logged yet, so
 * the generator's {@code >= today - 1} freshness gate would pick up YESTERDAY's row and the
 * prompt ("{{NÉV}} most rögzítette a ma éjszakai alvását") would narrate it as last night — plus
 * a "Mezo · alvás" push at dawn about a night the user already knows. In the rare case it IS
 * already logged (e.g. a 05:30 "cron előtt logolt alvás" log), the AFTER_COMMIT listener has
 * already created the row, making the cron call a harmless no-op — so the call is either useless
 * or wrong, and is not made here. Deliberately TODAY only, no backfill — the lazy GET covers a
 * missed run.
 * Idempotent (generate returns an existing row untouched); per-user failures are isolated so one
 * bad user never kills the run.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH,
                FeaturesConfiguration.FEED_JOB_SWITCH},
        havingValue = "true")
public class CompanionMessageJob {

    private final UserFanOut userFanOut;
    private final CompanionMessageGenerator companionMessageGenerator;

    @Scheduled(cron = "${mezo.proactive.feed.morning-cron}")
    public void runMorning() {
        LocalDate today = LocalDate.now();
        AtomicInteger generated = new AtomicInteger();
        userFanOut.forEachActiveUser("Companion-feed morning", user -> {
            try {
                if (companionMessageGenerator.generateMorning(user.getId(), today) != null) {
                    generated.incrementAndGet();
                }
            } catch (Exception e) {
                log.warn("Morning-message pre-generation failed for user {} on {}", user.getId(), today, e);
            }
            // Emberek S6 (mezo-06o0.8): SZÁNDÉKOSAN csak itt, a hajnali cronban — nem az
            // ensureTodayCronKinds lusta miss-recovery ágában. Az a feed GET-jén futna, és egy
            // sima GET /api/people-ből sosem szabad LLM-hívás lennie. Egy kimaradt hajnali futást
            // a Task 3 determinisztikus tartaléka fed le a hub Mezo-sávjában.
            try {
                companionMessageGenerator.generatePeopleObservation(user.getId(), today);
            } catch (Exception e) {
                log.warn("People-observation pre-generation failed for user {} on {}", user.getId(), today, e);
            }
        });
        log.info("Companion-feed morning run for {}: {} morning message(s) present", today, generated.get());
    }

    @Scheduled(cron = "${mezo.proactive.feed.midday-cron}")
    public void runMidday() {
        runWindow(CompanionMessageEntity.KIND_MIDDAY);
    }

    @Scheduled(cron = "${mezo.proactive.feed.evening-cron}")
    public void runEvening() {
        runWindow(CompanionMessageEntity.KIND_EVENING);
    }

    /**
     * Round 2 S2 (bd mezo-d58h.7.2, spec §12): the ~15:00 training-day hydration checkpoint.
     *
     * <p>The spec sketched this as a branch of the hourly flag sweep, but {@code FlagSweepJob}
     * lives in {@code feature.companion} and the generator in {@code feature.proactive}, where
     * {@code proactive -> companion} already exists in bulk — the call would close a NEW feature
     * slice cycle that {@code ArchitectureTest.feature_slices_are_cycle_free} rejects. A 4th cron
     * on THIS job satisfies the spec's real constraints (no new job class, nothing added to the
     * dawn cluster) without a port inversion whose only purpose would be dodging a cron line.
     *
     * <p>Emits nothing on a day without a shortfall — this is not a fixed daily prompt, and unlike
     * the window kinds it is deliberately NOT part of the feed GET's lazy miss-recovery: a
     * checkpoint recovered at 22:00 would nag about a day that is already over.
     */
    @Scheduled(cron = "${mezo.proactive.hydration.checkpoint-cron}")
    public void runHydrationCheckpoint() {
        LocalDate today = LocalDate.now();
        AtomicInteger generated = new AtomicInteger();
        userFanOut.forEachActiveUser("Companion-feed hydration checkpoint", user -> {
            try {
                if (companionMessageGenerator.generateHydrationCheckpoint(user.getId(), today) != null) {
                    generated.incrementAndGet();
                }
            } catch (Exception e) {
                log.warn("Hydration-checkpoint generation failed for user {} on {}", user.getId(), today, e);
            }
        });
        log.info("Hydration checkpoint run for {}: {} message(s) present", today, generated.get());
    }

    private void runWindow(String kind) {
        LocalDate today = LocalDate.now();
        AtomicInteger generated = new AtomicInteger();
        userFanOut.forEachActiveUser("Companion-feed " + kind, user -> {
            try {
                if (companionMessageGenerator.generateWindow(user.getId(), today, kind) != null) {
                    generated.incrementAndGet();
                }
            } catch (Exception e) {
                log.warn("{} companion-feed generation failed for user {} on {}", kind, user.getId(), today, e);
            }
        });
        log.info("Companion-feed {} run for {}: {} message(s) present", kind, today, generated.get());
    }
}

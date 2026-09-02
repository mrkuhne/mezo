package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
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
 * prompt ("Daniel most rögzítette a ma éjszakai alvását") would narrate it as last night — plus
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

    private final AppUserRepository appUserRepository;
    private final CompanionMessageGenerator companionMessageGenerator;

    @Scheduled(cron = "${mezo.proactive.feed.morning-cron}")
    public void runMorning() {
        LocalDate today = LocalDate.now();
        int generated = 0;
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                if (companionMessageGenerator.generateMorning(user.getId(), today) != null) {
                    generated++;
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
        }
        log.info("Companion-feed morning run for {}: {} morning message(s) present", today, generated);
    }

    @Scheduled(cron = "${mezo.proactive.feed.midday-cron}")
    public void runMidday() {
        runWindow(CompanionMessageEntity.KIND_MIDDAY);
    }

    @Scheduled(cron = "${mezo.proactive.feed.evening-cron}")
    public void runEvening() {
        runWindow(CompanionMessageEntity.KIND_EVENING);
    }

    private void runWindow(String kind) {
        LocalDate today = LocalDate.now();
        int generated = 0;
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                if (companionMessageGenerator.generateWindow(user.getId(), today, kind) != null) {
                    generated++;
                }
            } catch (Exception e) {
                log.warn("{} companion-feed generation failed for user {} on {}", kind, user.getId(), today, e);
            }
        }
        log.info("Companion-feed {} run for {}: {} message(s) present", kind, today, generated);
    }
}

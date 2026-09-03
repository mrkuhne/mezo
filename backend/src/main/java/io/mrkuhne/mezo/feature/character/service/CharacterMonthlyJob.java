package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Karakter monthly deep-read konzílium cron (Karakter S4, mezo-1gim.6): for every user, on the
 * month's FIRST Sunday, runs {@link CharacterMonthlyService#run(java.util.UUID, LocalDate)} for
 * {@code monthStart = LocalDate.now().withDayOfMonth(1)}.
 *
 * <p>The schedule itself ({@code mezo.character.monthly.cron}) is a PLAIN Sunday cron (no
 * day-of-month restriction) — Spring's cron day-of-month + day-of-week fields are OR'd together
 * (not AND'ed) once both are restricted below their wildcard, so an expression like
 * {@code "0 0 20 1-7 * SUN"} would fire on EVERY Sunday plus every day 1–7 of the month
 * regardless of weekday, not just "the first Sunday" — the opposite of what it looks like it
 * says. {@link #isDeepReadDay(LocalDate)} is the reliable code-level guard this run() method
 * checks FIRST, so only the month's actual first Sunday does real work; every other Sunday this
 * fires on is a silent no-op. Idempotent per (user, month) regardless — the service returns the
 * existing MONTHLY row (or {@code null} for the honest empty dossier) instead of re-running — so
 * even if the guard were ever loosened, catch-up stays safe. Per-user failures are isolated (the
 * {@code CharacterConferenceJob} idiom).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
                FeaturesConfiguration.CHARACTER_MONTHLY_JOB_SWITCH},
        havingValue = "true")
public class CharacterMonthlyJob {

    private final UserFanOut userFanOut;
    private final CharacterMonthlyService monthlyService;

    @Scheduled(cron = "${mezo.character.monthly.cron}")
    public void run() {
        LocalDate today = LocalDate.now();
        if (!isDeepReadDay(today)) {
            return;
        }
        LocalDate monthStart = today.withDayOfMonth(1);
        AtomicInteger held = new AtomicInteger();
        userFanOut.forEachActiveUser("Character monthly", user -> {
            try {
                if (monthlyService.run(user.getId(), monthStart) != null) {
                    held.incrementAndGet();
                }
            } catch (Exception e) {
                log.warn("Character monthly run failed for user {} month {}", user.getId(), monthStart, e);
            }
        });
        log.info("Character monthly run for month {}: {} konzílium(s) held", monthStart, held.get());
    }

    /**
     * True iff {@code today} is a Sunday AND its day-of-month is {@code <= 7} — i.e. it is the
     * month's FIRST Sunday. Public + pure (no Spring/DB) so {@code CharacterMonthlyScheduleTest}
     * can pin this against hardcoded dates, independent of {@link #run()} and of the cron string
     * in application.yml (see the class javadoc for why the cron alone cannot express this).
     */
    public static boolean isDeepReadDay(LocalDate today) {
        return today.getDayOfWeek() == DayOfWeek.SUNDAY && today.getDayOfMonth() <= 7;
    }
}

package io.mrkuhne.mezo.feature.progression.service;

import io.mrkuhne.mezo.api.dto.GrowthWeekResponse;
import io.mrkuhne.mezo.feature.progression.ActivityLedgerSource;
import io.mrkuhne.mezo.feature.progression.QuestLedgerSource;
import io.mrkuhne.mezo.feature.progression.repository.LevelUpEventRepository;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

/**
 * Weekly growth aggregate (E3, bd mezo-6ng8): closed daily quests, LIFE XP earned, activity-log
 * entries and savings per ISO week (Monday-keyed, system zone — the TraitCalculator precedent).
 * Consumed by the REST endpoint (Insights Weekly card) AND the proactive digest block. Honest
 * zeros — a week with no growth data is a fact, not an error.
 */
@Service
@RequiredArgsConstructor
public class GrowthWeekService {

    private final LevelUpEventRepository levelUpEventRepository;
    private final ObjectProvider<QuestLedgerSource> questLedgerSource;
    private final ObjectProvider<ActivityLedgerSource> activityLedgerSource;

    public GrowthWeekResponse growthWeek(UUID createdBy, LocalDate anyDayOfWeek) {
        LocalDate weekStart = anyDayOfWeek.with(DayOfWeek.MONDAY);
        LocalDate weekEnd = weekStart.plusDays(6);

        int questCompleted = 0;
        int questClosed = 0;
        QuestLedgerSource quests = questLedgerSource.getIfAvailable();
        if (quests != null) {
            QuestLedgerSource.Stats s = quests.closedQuestStats(createdBy, weekStart, weekEnd);
            questCompleted = s.completed();
            questClosed = s.completed() + s.expired();
        }

        int activities = 0;
        long savingsHuf = 0;
        ActivityLedgerSource activityLedger = activityLedgerSource.getIfAvailable();
        if (activityLedger != null) {
            ActivityLedgerSource.Stats s = activityLedger.stats(createdBy, weekStart, weekEnd);
            activities = s.entries();
            savingsHuf = s.savingsHuf();
        }

        ZoneId zone = ZoneId.systemDefault();
        Instant from = weekStart.atStartOfDay(zone).toInstant();
        Instant until = weekEnd.plusDays(1).atStartOfDay(zone).toInstant();
        long lifeXp = levelUpEventRepository.findByCreatedByAndOccurredAtGreaterThanEqual(createdBy, from)
            .stream()
            .filter(e -> e.getOccurredAt().isBefore(until))
            .flatMap(e -> e.getPayload().gains().stream())
            .filter(g -> "LIFE".equals(g.kind()))
            .mapToLong(g -> g.xpGained())
            .sum();

        return GrowthWeekResponse.builder()
            .weekStart(weekStart)
            .questCompleted(questCompleted)
            .questClosed(questClosed)
            .lifeXp(lifeXp)
            .activities(activities)
            .savingsHuf(savingsHuf)
            .build();
    }
}

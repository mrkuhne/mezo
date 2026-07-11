package io.mrkuhne.mezo.feature.progression.service;

import io.mrkuhne.mezo.api.dto.ProfileTraits;
import io.mrkuhne.mezo.feature.progression.QuestLedgerSource;
import io.mrkuhne.mezo.feature.progression.TrainingCommitmentSource;
import io.mrkuhne.mezo.feature.progression.repository.LevelUpEventRepository;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

/**
 * Computed behavior traits (ADR 0010 §4 — mirrored back, never self-claimed), derived on read:
 * discipline = 28-day completion ratio over commitments (planned training sessions + closed daily
 * quests, available components averaged); consistency = current streak of consecutive weeks with
 * >= ACTIVE_DAYS_PER_WEEK active days (a day with any XP-earning action in the level_up_event
 * ledger). The current, still-running week counts only once it already meets the bar — an
 * unfinished week never breaks the streak (grace, mirrors the robustness streak's tone).
 */
@Component
@RequiredArgsConstructor
public class TraitCalculator {

    static final int DISCIPLINE_WINDOW_DAYS = 28;
    static final int ACTIVE_DAYS_PER_WEEK = 4;
    static final int CONSISTENCY_HORIZON_DAYS = 400;

    private final LevelUpEventRepository levelUpEventRepository;
    private final TrainingCommitmentSource trainingCommitmentSource;
    private final ObjectProvider<QuestLedgerSource> questLedgerSource;

    public ProfileTraits traits(UUID createdBy, LocalDate today) {
        return ProfileTraits.builder()
            .disciplinePct(disciplinePct(createdBy, today))
            .consistencyWeeks(consistencyWeeks(createdBy, today))
            .build();
    }

    private Integer disciplinePct(UUID createdBy, LocalDate today) {
        LocalDate from = today.minusDays(DISCIPLINE_WINDOW_DAYS - 1L);
        double sum = 0;
        int components = 0;

        TrainingCommitmentSource.Stats training = trainingCommitmentSource.commitmentStats(createdBy, from, today);
        if (training.planned() > 0) {
            sum += Math.min(1.0, (double) training.done() / training.planned());
            components++;
        }
        QuestLedgerSource quests = questLedgerSource.getIfAvailable();
        if (quests != null) {
            QuestLedgerSource.Stats s = quests.closedQuestStats(createdBy, from, today);
            int closed = s.completed() + s.expired();
            if (closed > 0) {
                sum += (double) s.completed() / closed;
                components++;
            }
        }
        return components == 0 ? null : (int) Math.round(100 * sum / components);
    }

    private int consistencyWeeks(UUID createdBy, LocalDate today) {
        ZoneId zone = ZoneId.systemDefault();
        Instant horizon = today.minusDays(CONSISTENCY_HORIZON_DAYS).atStartOfDay(zone).toInstant();
        Map<LocalDate, Long> activeDaysByWeek = new HashMap<>();
        levelUpEventRepository.findOccurredAtSince(createdBy, horizon).stream()
            .map(i -> LocalDate.ofInstant(i, zone))
            .distinct()
            .forEach(d -> activeDaysByWeek.merge(d.with(DayOfWeek.MONDAY), 1L, Long::sum));

        LocalDate week = today.with(DayOfWeek.MONDAY);
        if (activeDaysByWeek.getOrDefault(week, 0L) < ACTIVE_DAYS_PER_WEEK) {
            week = week.minusWeeks(1); // grace: the running week can't break the streak yet
        }
        int streak = 0;
        while (activeDaysByWeek.getOrDefault(week, 0L) >= ACTIVE_DAYS_PER_WEEK) {
            streak++;
            week = week.minusWeeks(1);
        }
        return streak;
    }
}

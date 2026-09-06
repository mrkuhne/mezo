package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.feature.companion.reflection.config.ReflectionProperties;
import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalEntity;
import io.mrkuhne.mezo.feature.companion.reflection.repository.TextSignalRepository;
import io.mrkuhne.mezo.feature.journal.entity.GratitudeEntryEntity;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.GratitudeEntryRepository;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Reflexió S1 (bd mezo-eq85.1): the nightly self-heal for text signals — the {@code
 * DailySummaryService} catch-up idiom. Every finished day inside the configured window is
 * re-offered: a journal/gratitude row whose newest signal is MISSING or whose content hash no
 * longer matches gets re-extracted (an entry written while the LLM was down, or edited while the
 * listener was off, heals itself), and every day without a {@code chat_day} signal is offered to
 * {@link ChatDaySignalService}.
 *
 * <p>Idempotent by construction: {@code TextSignalService.record} short-circuits on an unchanged
 * hash, so a second run of the same night costs no LLM call and writes nothing. Task 2's job is
 * the only production caller.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class TextSignalCatchUpService {

    private final JournalEntryRepository journalEntryRepository;
    private final GratitudeEntryRepository gratitudeEntryRepository;
    private final TextSignalRepository textSignalRepository;
    private final TextSignalService textSignalService;
    private final ChatDaySignalService chatDaySignalService;
    private final ReflectionProperties properties;

    /** @return how many signal rows this run wrote. */
    public int catchUp(UUID userId, LocalDate today) {
        LocalDate to = today.minusDays(1);
        LocalDate from = to.minusDays(properties.catchUpDays() - 1L);
        int written = 0;
        for (JournalEntryEntity entry : journalEntryRepository
                .findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(
                        userId, from, to)) {
            written += recordIfStale(userId, TextSignalEntity.SOURCE_JOURNAL, entry.getId(),
                    entry.getOccurredOn(), entry.getText());
        }
        for (GratitudeEntryEntity entry : gratitudeEntryRepository
                .findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(
                        userId, from, to)) {
            written += recordIfStale(userId, TextSignalEntity.SOURCE_GRATITUDE, entry.getId(),
                    entry.getOccurredOn(), entry.getText());
        }
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            written += chatDayIfMissing(userId, day);
        }
        return written;
    }

    private int recordIfStale(UUID userId, String sourceKind, UUID sourceId, LocalDate day, String text) {
        if (textSignalService.isUpToDate(userId, sourceKind, sourceId, text)) {
            return 0;
        }
        try {
            return textSignalService.record(userId, sourceKind, sourceId, day, text).isPresent() ? 1 : 0;
        } catch (Exception e) {
            // one bad source must never abort the night's remaining sources
            log.warn("Text signal catch-up failed for {} {}", sourceKind, sourceId, e);
            return 0;
        }
    }

    private int chatDayIfMissing(UUID userId, LocalDate day) {
        if (textSignalRepository
                .findFirstByCreatedByAndSourceKindAndOccurredOnAndDeletedFalseOrderByVersionDesc(
                        userId, TextSignalEntity.SOURCE_CHAT_DAY, day)
                .isPresent()) {
            return 0;
        }
        try {
            return chatDaySignalService.extractDay(userId, day).isPresent() ? 1 : 0;
        } catch (Exception e) {
            log.warn("Chat-day signal catch-up failed for user {} day {}", userId, day, e);
            return 0;
        }
    }
}

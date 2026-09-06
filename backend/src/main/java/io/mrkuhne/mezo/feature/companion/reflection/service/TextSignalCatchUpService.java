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
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Reflexió S1 (bd mezo-eq85.1): the nightly self-heal for text signals — the {@code
 * DailySummaryService} catch-up idiom. Every finished day inside the configured window is
 * re-offered UNCONDITIONALLY, and the content hash decides what happens: a journal/gratitude row
 * whose newest signal is MISSING or whose hash no longer matches gets re-extracted (an entry
 * written while the LLM was down, or edited while the listener was off, heals itself), and every
 * day is offered to {@link ChatDaySignalService}, so a day whose conversation continued after the
 * first extraction re-versions its own signal instead of keeping a stale one forever.
 *
 * <p>Idempotent by construction: {@code TextSignalService.record} short-circuits on an unchanged
 * hash, so a second run of the same night costs no LLM call and writes no row — but it DOES
 * re-apply the {@code memory_item} enrichment, which is what makes this pass a genuine self-heal
 * for the projection race. Nothing is skipped on an up-to-date signal; see {@link #offer}. The
 * return value counts real writes, so an all-unchanged night returns 0. Task 2's job is the only
 * production caller.
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
            written += offer(userId, TextSignalEntity.SOURCE_JOURNAL, entry.getId(),
                    entry.getOccurredOn(), entry.getText());
        }
        for (GratitudeEntryEntity entry : gratitudeEntryRepository
                .findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(
                        userId, from, to)) {
            written += offer(userId, TextSignalEntity.SOURCE_GRATITUDE, entry.getId(),
                    entry.getOccurredOn(), entry.getText());
        }
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            written += chatDay(userId, day);
        }
        return written;
    }

    /**
     * Every source is re-offered UNCONDITIONALLY — {@code record} is hash-idempotent, so an
     * unchanged text costs no LLM call and writes no row, and an up-to-date source is NOT skipped
     * here: re-offering it is what re-applies the {@code memory_item.people}/{@code topics}
     * enrichment that a racing memory projection may have wiped (see {@code TextSignalService}).
     * Gating on {@link TextSignalService#isUpToDate} would make the self-heal unreachable — the
     * race state (row present, hash unchanged, enrichment wiped) is exactly what that gate filters
     * out, and no later projection restores it either. The staleness check is therefore used only
     * to decide whether this counted as a WRITE, never whether to call.
     */
    private int offer(UUID userId, String sourceKind, UUID sourceId, LocalDate day, String text) {
        try {
            boolean upToDate = textSignalService.isUpToDate(userId, sourceKind, sourceId, text);
            boolean recorded = textSignalService.record(userId, sourceKind, sourceId, day, text).isPresent();
            return !upToDate && recorded ? 1 : 0;
        } catch (Exception e) {
            // one bad source must never abort the night's remaining sources
            log.warn("Text signal catch-up failed for {} {}", sourceKind, sourceId, e);
            return 0;
        }
    }

    /**
     * The day is offered UNCONDITIONALLY too, for the same reason plus one of its own: a day whose
     * conversation continued after the first extraction has changed text, and skipping days that
     * already carry a {@code chat_day} signal would freeze that first extraction forever. The
     * synthetic source id is stable per (user, day), so a changed day re-versions instead of
     * duplicating; an unchanged day costs nothing.
     */
    private int chatDay(UUID userId, LocalDate day) {
        try {
            Optional<UUID> before = textSignalRepository
                    .findFirstByCreatedByAndSourceKindAndOccurredOnAndDeletedFalseOrderByVersionDesc(
                            userId, TextSignalEntity.SOURCE_CHAT_DAY, day)
                    .map(TextSignalEntity::getId);
            Optional<UUID> after = chatDaySignalService.extractDay(userId, day)
                    .map(TextSignalEntity::getId);
            return after.isPresent() && !after.equals(before) ? 1 : 0;
        } catch (Exception e) {
            log.warn("Chat-day signal catch-up failed for user {} day {}", userId, day, e);
            return 0;
        }
    }
}

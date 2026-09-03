package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.embedding.MemoryEmbeddingWriter;
import io.mrkuhne.mezo.feature.companion.embedding.NoteEmbeddingCatchUp;
import io.mrkuhne.mezo.feature.companion.embedding.NoteMentionCatchUp;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

/**
 * The V2.2 nightly narrative-memory job — the app's first {@code @Scheduled} cron. For every
 * user and every FINISHED day in the catch-up window it (a) generates the missing
 * {@code daily_summary} (idempotent — an existing day is returned, not regenerated) and (b)
 * embeds it; then (c) catch-up-embeds any chat turns still missing their vector (covers
 * listener-off periods, crashes, and pre-V2.2 history); and, since W1.5 (spec §5.5, bd
 * mezo-b3pp.5), (d) runs {@link NoteEmbeddingCatchUp} — the narrative written OUTSIDE the journal
 * ({@code activity_log.text}, {@code check_in.note}) has NO listener, so this one nightly sweep is
 * its only writer (its own toggle, length gate and per-run budget live in the pass); and, since S2
 * (spec §3.2, bd mezo-06o0.1), (e) runs {@link NoteMentionCatchUp} right after it, same per-user
 * try-guard — the same journal-outside notes also carry name mentions, which have no listener
 * either. Injected via {@link ObjectProvider} because the bean only exists when BOTH
 * {@code PEOPLE_SWITCH} and {@code COMPANION_SWITCH} are on. Per-date failures are isolated: one
 * bad day must never kill the run — the next night retries it via the same catch-up.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.DAILY_SUMMARY_JOB_SWITCH},
        havingValue = "true")
public class DailySummaryJob {

    private final UserFanOut userFanOut;
    private final DailySummaryService dailySummaryService;
    private final MemoryEmbeddingWriter memoryEmbeddingWriter;
    private final CompanionProperties properties;
    private final NoteEmbeddingCatchUp noteEmbeddingCatchUp;
    private final ObjectProvider<NoteMentionCatchUp> noteMentionCatchUp;

    @Scheduled(cron = "${mezo.companion.summary.cron}")
    public void run() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        LocalDate from = yesterday.minusDays(properties.summary().catchUpDays() - 1L);
        userFanOut.forEachActiveUser("Daily summary", user -> {
            int generated = 0;
            for (LocalDate date = from; !date.isAfter(yesterday); date = date.plusDays(1)) {
                try {
                    DailySummaryEntity summary = dailySummaryService.generate(user.getId(), date);
                    if (summary != null) {
                        memoryEmbeddingWriter.writeSummary(summary);
                        generated++;
                    }
                } catch (Exception e) {
                    log.warn("Daily summary failed for user {} on {}", user.getId(), date, e);
                }
            }
            // The catch-up pass HEALS the listener's toggle, it must not BYPASS it: turns are
            // only embedded (live or catch-up) while embed-chat-turns is on. One turn = one
            // transaction, so a failing/racing unit cannot abort the rest of the batch.
            if (properties.embedding().embedChatTurns()) {
                try {
                    for (UUID turnId : memoryEmbeddingWriter.findUnembeddedTurnIds(user.getId(),
                            from.atStartOfDay(ZoneId.systemDefault()).toInstant())) {
                        try {
                            memoryEmbeddingWriter.embedTurnByMessageId(turnId);
                        } catch (Exception e) {
                            log.warn("Turn-embedding catch-up failed for turn {}", turnId, e);
                        }
                    }
                } catch (Exception e) {
                    log.warn("Turn-embedding catch-up failed for user {}", user.getId(), e);
                }
            }
            // W1.5 (spec §5.5): one nightly narrative sweep, not a new cron — the notes written
            // OUTSIDE the journal join the memory here. Its own toggle + batch budget live in the
            // pass; a failing row is isolated there, so nothing can abort the user's run.
            int notes = 0;
            try {
                notes = noteEmbeddingCatchUp.run(user.getId(), yesterday);
            } catch (Exception e) {
                log.warn("Note-embedding catch-up failed for user {}", user.getId(), e);
            }
            // S2 (spec §3.2): the same journal-outside notes have no mention listener either — one
            // sweep, right after the embedding one, same per-user isolation. ObjectProvider because
            // the bean is conditional on PEOPLE_SWITCH ∧ COMPANION_SWITCH (may not exist).
            noteMentionCatchUp.ifAvailable(catchUp -> {
                try {
                    int mentions = catchUp.run(user.getId(), yesterday);
                    if (mentions > 0) {
                        log.info("Note mention catch-up wrote {} mentions for user {}", mentions, user.getId());
                    }
                } catch (Exception e) {
                    log.warn("Note-mention catch-up failed for user {}", user.getId(), e);
                }
            });
            log.info("Daily-summary run for user {}: {} day(s) processed, {} note(s) embedded in window {}..{}",
                    user.getId(), generated, notes, from, yesterday);
        });
    }
}

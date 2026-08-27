package io.mrkuhne.mezo.feature.companion.embedding;

import io.mrkuhne.mezo.feature.companion.NarrativeNoteSource;
import io.mrkuhne.mezo.feature.companion.NarrativeNoteSource.Note;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * W1.5 (spec §5.5, bd mezo-b3pp.5) — the nightly sweep's note pass: the narrative Daniel writes
 * OUTSIDE the journal (QuickInput „Napló" {@code activity_log.text} and {@code check_in.note})
 * joins the vector memory as {@code activity_note}/{@code checkin_note}, sourced through
 * {@link NarrativeNoteSource} implementations rather than the owning features' repositories
 * directly — see that port's javadoc for why (a direct companion → activity/biometrics import
 * would close a NEW slice cycle under {@code ArchitectureTest#feature_slices_are_cycle_free}).
 *
 * <p>There is no live listener behind these kinds: this pass is the ONLY writer, which is why it
 * carries no lower date bound. Every live, length-gated row that has no vector yet is a candidate,
 * so the very first run doubles as the one-time HISTORY BACKFILL and every later run finds only
 * what the previous ones missed (already-embedded rows drop out via the ref-id set). {@code
 * note-batch-size} bounds one run so a long history spreads over nights instead of one burst.
 *
 * <p>Per-row isolation: {@link #run} is deliberately NOT transactional — each
 * {@link MemoryEmbeddingWriter} call goes through the proxy in its OWN transaction, so a failing or
 * racing row is logged and the loop continues (the {@code DailySummaryJob} turn-catch-up idiom).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class NoteEmbeddingCatchUp {

    private final ObjectProvider<NarrativeNoteSource> noteSources;
    private final MemoryEmbeddingRepository memoryEmbeddingRepository;
    private final MemoryEmbeddingWriter memoryEmbeddingWriter;
    private final CompanionProperties properties;

    /**
     * Embeds this user's still-unembedded notes up to and including {@code through}, newest run
     * first-come, oldest row first. Returns how many vectors were written (the caller logs it).
     * The toggle is checked HERE so the pass heals it rather than bypasses it. Sources are
     * injected as {@link ObjectProvider} — not {@code List<NarrativeNoteSource>} — precisely
     * because a plain {@code List<T>} constructor parameter with zero matching beans resolves to
     * {@code null} in Spring, which then fails context startup on the required dependency;
     * {@link ObjectProvider#orderedStream()} instead yields an empty stream when nothing is on the
     * classpath. That makes zero note sources (no implementation on the classpath, or every one
     * switched off) an actually-safe no-op today, and means a FUTURE
     * {@code @ConditionalOnProperty} on either adapter can drop it to zero without risking the
     * context. Both sources currently share one budget pool consumed in {@code orderedStream()}
     * order: that decides which KIND gets backfilled first on a large history, not whether both
     * eventually converge (see {@link #embed} for the starved-source log).
     */
    public int run(UUID userId, LocalDate through) {
        if (!properties.embedding().embedNotes()) {
            return 0;
        }
        int minChars = properties.embedding().noteMinChars();
        int budget = properties.embedding().noteBatchSize();

        int written = 0;
        for (NarrativeNoteSource source : noteSources.orderedStream().toList()) {
            written += embed(source, userId, through, minChars, budget - written);
        }
        return written;
    }

    /** One source's pass: drop what already has a vector, honour the remaining budget, isolate failures. */
    private int embed(NarrativeNoteSource source, UUID userId, LocalDate through, int minChars, int budget) {
        String kind = source.kind();
        if (budget <= 0) {
            log.info("Note-embedding budget already exhausted before user {} kind {} got a turn — "
                    + "starved this run, waits for the next one", userId, kind);
            return 0;
        }
        List<Note> candidates = source.notesToEmbed(userId, through, minChars);
        if (candidates.isEmpty()) {
            return 0;
        }
        Set<UUID> alreadyEmbedded = memoryEmbeddingRepository.findRefIdsByCreatedByAndKind(userId, kind);
        int written = 0;
        for (Note note : candidates) {
            if (written >= budget) {
                log.info("Note-embedding budget reached for user {} kind {} — the rest waits for the next run",
                        userId, kind);
                break;
            }
            if (alreadyEmbedded.contains(note.id())) {
                continue;
            }
            try {
                // W1.5 (mezo-b3pp.26): syncNote(kind, note) — this call ignores the boolean for now;
                // Task 2 reworks this sweep to spend it against the run's embed budget.
                memoryEmbeddingWriter.syncNote(kind, note);
                written++;
            } catch (Exception e) {
                log.warn("Note-embedding failed for user {} kind {} ref {}", userId, kind, note.id(), e);
            }
        }
        return written;
    }
}

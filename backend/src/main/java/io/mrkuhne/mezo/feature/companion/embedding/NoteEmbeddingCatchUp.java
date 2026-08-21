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

    private final List<NarrativeNoteSource> noteSources;
    private final MemoryEmbeddingRepository memoryEmbeddingRepository;
    private final MemoryEmbeddingWriter memoryEmbeddingWriter;
    private final CompanionProperties properties;

    /**
     * Embeds this user's still-unembedded notes up to and including {@code through}, newest run
     * first-come, oldest row first. Returns how many vectors were written (the caller logs it).
     * The toggle is checked HERE so the pass heals it rather than bypassing it. An empty
     * {@code noteSources} (no implementation on the classpath, or every one switched off) is a
     * legitimate no-op, not an error.
     */
    public int run(UUID userId, LocalDate through) {
        if (!properties.embedding().embedNotes()) {
            return 0;
        }
        int minChars = properties.embedding().noteMinChars();
        int budget = properties.embedding().noteBatchSize();

        int written = 0;
        for (NarrativeNoteSource source : noteSources) {
            written += embed(source, userId, through, minChars, budget - written);
        }
        return written;
    }

    /** One source's pass: drop what already has a vector, honour the remaining budget, isolate failures. */
    private int embed(NarrativeNoteSource source, UUID userId, LocalDate through, int minChars, int budget) {
        if (budget <= 0) {
            return 0;
        }
        String kind = source.kind();
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
                memoryEmbeddingWriter.writeNote(kind, note);
                written++;
            } catch (Exception e) {
                log.warn("Note-embedding failed for user {} kind {} ref {}", userId, kind, note.id(), e);
            }
        }
        return written;
    }
}

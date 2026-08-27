package io.mrkuhne.mezo.feature.companion.embedding;

import io.mrkuhne.mezo.feature.companion.NarrativeNoteSource;
import io.mrkuhne.mezo.feature.companion.NarrativeNoteSource.Note;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository.RefContent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
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
 * carries no lower date bound. Every live, length-gated row is a candidate whether or not it
 * already has a vector — {@link MemoryEmbeddingWriter#syncNote} compares against the STORED
 * content and only spends an embed call on a first write or a drift re-embed (mezo-b3pp.26), so
 * the very first run doubles as the one-time HISTORY BACKFILL and every later run both catches up
 * what it missed and heals what changed underneath it. {@code note-batch-size} bounds one run so a
 * long history spreads over nights instead of one burst.
 *
 * <p>Lifecycle since mezo-b3pp.26: {@link #embed} also REAPS — a vector whose source row is no
 * longer live is soft-deleted, outside the budget, before any re-embed spends it (IDENT-3 honesty
 * beats throughput). One deliberate residue: a live note edited down BELOW {@code note-min-chars}
 * is neither a reap candidate (still live) nor an embed candidate (below the length gate), so its
 * stale vector survives untouched — reaping on the length gate instead would mean that merely
 * raising {@code note-min-chars} mass-deletes a user's existing vectors on the next nightly run.
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

    /**
     * One source's pass: reap ALWAYS runs first, unconditionally on the budget — even a source
     * that gets its turn with the run's budget already spent by an earlier one (mezo-b3pp.26
     * fix: the reap must not be starved by that) still reaps, because a vector whose source is
     * gone must stop being recallable tonight regardless of embedding budget (IDENT-3 honesty
     * beats throughput). Only the write/re-embed loop is budget-gated. Per-row failures on
     * either half are isolated.
     */
    private int embed(NarrativeNoteSource source, UUID userId, LocalDate through, int minChars, int budget) {
        String kind = source.kind();
        // What the vectors currently SAY, keyed by source row — the sweep compares against this
        // instead of merely asking "does a vector exist?" (mezo-b3pp.26). These kinds have no
        // listener, so drift and orphaning can only be noticed here.
        Map<UUID, String> storedByRef = memoryEmbeddingRepository
                .findRefContentByCreatedByAndKind(userId, kind).stream()
                .collect(Collectors.toMap(RefContent::getRefId, RefContent::getContent));

        // REAP first, ALWAYS, and outside the budget: a reap spends no embedding call, and a
        // vector whose source is gone must stop being recallable tonight even if THIS source's
        // turn starts with the run's budget already exhausted by an earlier source (IDENT-3
        // honesty beats throughput) — this must run before any budget check, not after it.
        int reaped = 0;
        if (!storedByRef.isEmpty()) {
            Set<UUID> live = source.liveNotes(userId, storedByRef.keySet()).stream()
                    .map(Note::id).collect(Collectors.toSet());
            for (UUID refId : storedByRef.keySet()) {
                if (live.contains(refId)) {
                    continue;
                }
                try {
                    memoryEmbeddingWriter.deleteNoteEmbedding(kind, refId);
                    reaped++;
                } catch (Exception e) {
                    log.warn("Note-vector reap failed for user {} kind {} ref {}", userId, kind, refId, e);
                }
            }
        }
        if (reaped > 0) {
            log.info("Reaped {} orphaned note vector(s) for user {} kind {}", reaped, userId, kind);
        }

        // The budget guards ONLY embedding from here on — a starved source still reaped above.
        if (budget <= 0) {
            log.info("Note-embedding budget already exhausted before user {} kind {} got a turn to embed "
                    + "(its reap still ran) — starved this run, waits for the next one", userId, kind);
            return 0;
        }

        List<Note> candidates = source.notesToEmbed(userId, through, minChars);
        int written = 0;
        for (Note note : candidates) {
            if (written >= budget) {
                log.info("Note-embedding budget reached for user {} kind {} — the rest waits for the next run",
                        userId, kind);
                break;
            }
            // Unchanged notes cost nothing and must not charge the budget — syncNote returns
            // false for them, which is the whole reason it returns a boolean.
            try {
                if (memoryEmbeddingWriter.syncNote(kind, note)) {
                    written++;
                }
            } catch (Exception e) {
                log.warn("Note-embedding failed for user {} kind {} ref {}", userId, kind, note.id(), e);
            }
        }
        return written;
    }
}

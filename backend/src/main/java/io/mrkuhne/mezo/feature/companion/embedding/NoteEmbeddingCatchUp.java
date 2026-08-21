package io.mrkuhne.mezo.feature.companion.embedding;

import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * W1.5 (spec §5.5, bd mezo-b3pp.5) — the nightly sweep's note pass: the narrative Daniel writes
 * OUTSIDE the journal (QuickInput „Napló" {@code activity_log.text} and {@code check_in.note})
 * joins the vector memory as {@code activity_note}/{@code checkin_note}.
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

    private final ActivityLogRepository activityLogRepository;
    private final CheckInRepository checkInRepository;
    private final MemoryEmbeddingRepository memoryEmbeddingRepository;
    private final MemoryEmbeddingWriter memoryEmbeddingWriter;
    private final CompanionProperties properties;

    /**
     * Embeds this user's still-unembedded notes up to and including {@code through}, newest run
     * first-come, oldest row first. Returns how many vectors were written (the caller logs it).
     * The toggle is checked HERE so the pass heals it rather than bypassing it.
     */
    public int run(UUID userId, LocalDate through) {
        if (!properties.embedding().embedNotes()) {
            return 0;
        }
        int minChars = properties.embedding().noteMinChars();
        int budget = properties.embedding().noteBatchSize();

        int written = embed(MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE, userId, budget,
                activityLogRepository.findNoteCandidates(userId, through, minChars),
                ActivityLogEntity::getId, memoryEmbeddingWriter::writeActivityNote);
        written += embed(MemoryEmbeddingEntity.KIND_CHECKIN_NOTE, userId, budget - written,
                checkInRepository.findNoteCandidates(userId, through, minChars),
                CheckInEntity::getId, memoryEmbeddingWriter::writeCheckInNote);
        return written;
    }

    /** One kind's pass: drop what already has a vector, honour the remaining budget, isolate failures. */
    private <T> int embed(String kind, UUID userId, int budget, List<T> candidates,
                          Function<T, UUID> idOf, Consumer<T> write) {
        if (budget <= 0 || candidates.isEmpty()) {
            return 0;
        }
        Set<UUID> alreadyEmbedded = memoryEmbeddingRepository.findRefIdsByCreatedByAndKind(userId, kind);
        int written = 0;
        for (T candidate : candidates) {
            if (written >= budget) {
                log.info("Note-embedding budget reached for user {} kind {} — the rest waits for the next run",
                        userId, kind);
                break;
            }
            if (alreadyEmbedded.contains(idOf.apply(candidate))) {
                continue;
            }
            try {
                write.accept(candidate);
                written++;
            } catch (Exception e) {
                log.warn("Note-embedding failed for user {} kind {} ref {}", userId, kind,
                        idOf.apply(candidate), e);
            }
        }
        return written;
    }
}

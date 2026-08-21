package io.mrkuhne.mezo.feature.companion.embedding;

import io.mrkuhne.mezo.feature.ritual.entity.RitualDayEntity;
import io.mrkuhne.mezo.feature.ritual.repository.RitualDayRepository;
import io.mrkuhne.mezo.feature.ritual.service.RitualClosedEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * W1.2 (bd mezo-b3pp.2, spec §5.2): after a Napzárás close commits — or a closed day's prose is
 * edited — embed the day's reflection into {@code memory_embedding(kind=reflection)}. The
 * {@code JournalEmbeddingListener} idiom: gated on BOTH the companion and the ritual switch
 * (either off ⇒ this bean does not exist, so no embed call can happen), AFTER_COMMIT so the
 * prose being embedded is prose that actually committed ({@code RitualClosedEvent} is published
 * INSIDE the writing transaction — the commit boundary is this consumer's job), and failures are
 * logged and swallowed: memory building must never break the ritual close (IDENT-3).
 *
 * <p>Unlike journal there is no create-then-fast-edit race to retry: the reflection is embedded
 * only on close (and on a post-close edit), never on every keystroke-save, so concurrent inserts
 * for the same {@code (kind, ref_id)} are not a realistic path. A lost race would surface as the
 * swallowed warning below and heal on the next edit.
 *
 * <p>The row is re-read by id rather than carried on the event, so a close and a fast follow-up
 * edit both embed the LATEST prose. A blank/cleared reflection is not a no-op — {@link
 * MemoryEmbeddingWriter#writeReflection} soft-deletes the vector, so a skipped or erased evening
 * stops being recallable.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.RITUAL_SWITCH},
        havingValue = "true")
public class ReflectionEmbeddingListener {

    private final MemoryEmbeddingWriter memoryEmbeddingWriter;
    private final RitualDayRepository ritualDayRepository;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onRitualClosed(RitualClosedEvent event) {
        try {
            // @SQLRestriction("is_deleted = false") already filters findById, so a null result
            // here covers "the day was soft-deleted" too.
            RitualDayEntity day = ritualDayRepository.findById(event.ritualDayId()).orElse(null);
            if (day == null) {
                return;
            }
            memoryEmbeddingWriter.writeReflection(day);
        } catch (Exception e) {
            log.warn("Reflection embedding failed for ritual day {}", event.ritualDayId(), e);
        }
    }
}

package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PatternEventRepository extends JpaRepository<PatternEventEntity, UUID> {

    List<PatternEventEntity> findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(
            UUID createdBy, UUID patternId);

    /** Feed (mezo-gzhp.1): the last snapshot before this one — to detect a band crossing. */
    Optional<PatternEventEntity> findFirstByCreatedByAndPatternIdAndKindAndDeletedFalseOrderByOccurredAtDesc(
            UUID createdBy, UUID patternId, String kind);

    /** W2.5 (mezo-b3pp.10): every {@code snapshot} event newer than {@code since} — the nightly
     *  reinforcement pass's "fresh pattern evidence" signal. Distinct pattern ids from this list
     *  are the patterns whose already-promoted graph node's edges get bumped tonight. */
    List<PatternEventEntity> findByCreatedByAndKindAndOccurredAtAfterAndDeletedFalse(
            UUID createdBy, String kind, Instant since);

    /** Karakter round-4 read layer (CharacterMetaReads): window read, bounded above for catch-up honesty. */
    List<PatternEventEntity> findByCreatedByAndKindInAndOccurredAtGreaterThanEqualAndOccurredAtLessThanAndDeletedFalse(
            UUID createdBy, Collection<String> kinds, Instant from, Instant toExclusive);
}

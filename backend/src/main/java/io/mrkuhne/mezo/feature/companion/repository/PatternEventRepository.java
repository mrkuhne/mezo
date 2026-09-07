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

    /** S2 (mezo-eq85.2): the newest evidence events, freshest first — the hit/miss streak read.
     *  Ten is deliberately more than any configured streak, so the streak can never be truncated. */
    List<PatternEventEntity> findTop10ByCreatedByAndPatternIdAndKindAndDeletedFalseOrderByOccurredAtDesc(
            UUID createdBy, UUID patternId, String kind);

    /** S2: how many events of one kind a pattern carries (user replies, evidence nights). */
    long countByCreatedByAndPatternIdAndKindAndDeletedFalse(
            UUID createdBy, UUID patternId, String kind);

    /** Karakter round-4 read layer (CharacterMetaReads): window read, bounded above for catch-up honesty. */
    List<PatternEventEntity> findByCreatedByAndKindInAndOccurredAtGreaterThanEqualAndOccurredAtLessThanAndDeletedFalse(
            UUID createdBy, Collection<String> kinds, Instant from, Instant toExclusive);
}

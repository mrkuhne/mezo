package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalEntity;
import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.reflection.repository.TextSignalRepository;
import io.mrkuhne.mezo.feature.companion.reflection.service.TextSignalExtractor.ExtractedSignal;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reflexió S1 (bd mezo-eq85.1): the write side of {@code text_signal}. Owns the versioning rule
 * (a changed text appends a version, an unchanged one is a no-op) and the ONE piece of enrichment
 * an LLM answer is allowed to perform on the memory platform.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class TextSignalService {

    /** The model tier the extractor rides — recorded in the provenance envelope, audit only. */
    private static final String PROVENANCE_MODEL = "companion-cheap";

    private final TextSignalRepository textSignalRepository;
    private final TextSignalExtractor extractor;
    private final MemoryItemRepository memoryItemRepository;

    /**
     * Idempotent on (source, content hash): the SAME text yields the existing newest row and costs
     * no LLM call; a CHANGED text appends {@code version + 1} instead of overwriting, so the older
     * extraction stays auditable. An extraction that produced nothing writes nothing.
     */
    @Transactional
    public Optional<TextSignalEntity> record(UUID userId, String sourceKind, UUID sourceId,
                                             LocalDate occurredOn, String text) {
        if (text == null || text.isBlank()) {
            return Optional.empty();
        }
        String hash = sha256(text);
        Optional<TextSignalEntity> newest = textSignalRepository
                .findFirstByCreatedByAndSourceKindAndSourceIdAndDeletedFalseOrderByVersionDesc(
                        userId, sourceKind, sourceId);
        if (newest.isPresent() && newest.get().getContentHash().equals(hash)) {
            // No LLM call — but DO re-apply the enrichment. Two AFTER_COMMIT listeners race on the
            // same journal save: this one, and the embedding seam's memory projection, whose writer
            // unconditionally resets memory_item.people/topics to the command's empty lists
            // (MemoryProjectionWriter:75-76). If the projection lands last, the enrichment is gone.
            // Re-applying it here is what makes the nightly catch-up a genuine self-heal for that
            // lost race — the source is re-offered, the hash matches, and the item is refreshed.
            reenrichFrom(userId, sourceKind, sourceId, newest.get());
            return newest;
        }
        Optional<ExtractedSignal> extracted = extractor.extract(userId, sourceKind, sourceId, text);
        if (extracted.isEmpty()) {
            return Optional.empty();
        }
        ExtractedSignal signal = extracted.get();
        TextSignalEntity row = new TextSignalEntity();
        row.setCreatedBy(userId);
        row.setSourceKind(sourceKind);
        row.setSourceId(sourceId);
        row.setOccurredOn(occurredOn);
        row.setContentHash(hash);
        row.setVersion(newest.map(n -> n.getVersion() + 1).orElse(1));
        row.setMood(signal.mood());
        row.setEnergy(signal.energy());
        row.setStress(signal.stress());
        row.setConfidence(signal.confidence());
        row.setPeople(new ArrayList<>(signal.people()));
        row.setTopics(new ArrayList<>(signal.topics()));
        row.setKeywords(new ArrayList<>(signal.keywords()));
        row.setProvenance(new TextSignalProvenanceEnvelope(
                PROVENANCE_MODEL, Instant.now().toString(), text.length()));
        TextSignalEntity saved = textSignalRepository.saveAndFlush(row);
        enrichMemoryItem(userId, sourceKind, sourceId, signal);
        return Optional.of(saved);
    }

    /** Owner-scoped suppression — used by the catch-up and by callers that already know the owner. */
    @Transactional
    public void suppress(UUID userId, String sourceKind, UUID sourceId) {
        textSignalRepository
                .findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(userId, sourceKind, sourceId)
                .forEach(textSignalRepository::delete); // @SQLDelete ⇒ soft delete
    }

    /**
     * Owner-less suppression for the delete listeners: a {@code *EntryDeletedEvent} carries only
     * the entry id, and by AFTER_COMMIT time the source row is soft-deleted, so its owner can no
     * longer be read from it. Safe without an owner filter — see the repository method's note.
     */
    @Transactional
    public void suppressBySource(String sourceKind, UUID sourceId) {
        textSignalRepository.findBySourceKindAndSourceIdAndDeletedFalse(sourceKind, sourceId)
                .forEach(textSignalRepository::delete);
    }

    /**
     * The ONLY memory-platform field an LLM answer may touch: {@code people} / {@code topics}.
     * {@code salience} is never written from a model answer (RAG spec §12) — it stays whatever the
     * deterministic projector set. No {@code memory_item} row yet (the projection is async) simply
     * means no enrichment this round; the nightly catch-up re-offers the source.
     */
    private void enrichMemoryItem(UUID userId, String sourceKind, UUID sourceId, ExtractedSignal signal) {
        enrich(userId, sourceKind, sourceId, signal.people(), signal.topics());
    }

    /** The same enrichment from an ALREADY STORED signal — no LLM call, used by the heal path. */
    private void reenrichFrom(UUID userId, String sourceKind, UUID sourceId, TextSignalEntity signal) {
        enrich(userId, sourceKind, sourceId, signal.getPeople(), signal.getTopics());
    }

    private void enrich(UUID userId, String sourceKind, UUID sourceId,
                        java.util.List<String> people, java.util.List<String> topics) {
        memoryItemRepository.findByCreatedByAndSourceKindAndSourceId(userId, sourceKind, sourceId)
                .ifPresent(item -> {
                    if (item.getPeople().equals(people) && item.getTopics().equals(topics)) {
                        return; // already in sync — no pointless write
                    }
                    item.setPeople(new ArrayList<>(people));
                    item.setTopics(new ArrayList<>(topics));
                    memoryItemRepository.saveAndFlush(item);
                });
    }

    /** Content identity of one extraction — the hash is what makes {@link #record} idempotent. */
    static String sha256(String text) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(text.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            // unreachable — SHA-256 is JDK-guaranteed; error_handling.md forbids raw runtime types
            throw new SystemRuntimeErrorException(SystemMessage.error("INTERNAL_ERROR").build());
        }
    }

    /** Package-visible read for the catch-up: does this source already have an up-to-date signal? */
    @Transactional(readOnly = true)
    public boolean isUpToDate(UUID userId, String sourceKind, UUID sourceId, String text) {
        if (text == null || text.isBlank()) {
            return true; // nothing extractable — never a catch-up candidate
        }
        String hash = sha256(text);
        return textSignalRepository
                .findFirstByCreatedByAndSourceKindAndSourceIdAndDeletedFalseOrderByVersionDesc(
                        userId, sourceKind, sourceId)
                .map(existing -> existing.getContentHash().equals(hash))
                .orElse(false);
    }
}

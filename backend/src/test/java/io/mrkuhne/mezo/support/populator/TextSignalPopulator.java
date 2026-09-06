package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalEntity;
import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.reflection.repository.TextSignalRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Test data factory for the {@code text_signal} aggregate (Reflexió S1, mezo-eq85.1) — persists via
 * {@code saveAndFlush} so the DB CHECKs fire.
 */
@TestComponent
@RequiredArgsConstructor
public class TextSignalPopulator {

    private final TextSignalRepository textSignalRepository;

    /** A {@code sure} signal at version 1 — the default series-visible shape. */
    public TextSignalEntity signal(UUID owner, String sourceKind, UUID sourceId, LocalDate day,
                                   Integer mood, Integer energy, Integer stress,
                                   List<String> people, List<String> topics) {
        return signal(owner, sourceKind, sourceId, day, mood, energy, stress, people, topics, 1);
    }

    /** Explicit version — for the "newest version wins per source" assertions. */
    public TextSignalEntity signal(UUID owner, String sourceKind, UUID sourceId, LocalDate day,
                                   Integer mood, Integer energy, Integer stress,
                                   List<String> people, List<String> topics, int version) {
        TextSignalEntity entity = new TextSignalEntity();
        entity.setCreatedBy(owner);
        entity.setSourceKind(sourceKind);
        entity.setSourceId(sourceId);
        entity.setOccurredOn(day);
        entity.setContentHash("h-" + sourceId + "-v" + version);
        entity.setVersion(version);
        entity.setMood(mood);
        entity.setEnergy(energy);
        entity.setStress(stress);
        entity.setConfidence(TextSignalEntity.CONFIDENCE_SURE);
        entity.setPeople(new ArrayList<>(people));
        entity.setTopics(new ArrayList<>(topics));
        entity.setKeywords(new ArrayList<>());
        entity.setProvenance(TextSignalProvenanceEnvelope.empty());
        return textSignalRepository.saveAndFlush(entity);
    }

    /** Persists edits made on a populated signal (e.g. flipping confidence to {@code unsure}). */
    public TextSignalEntity save(TextSignalEntity signal) {
        return textSignalRepository.saveAndFlush(signal);
    }
}

package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEvidenceEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Test data factory for {@code pattern} rows (V3.1). */
@TestComponent
@RequiredArgsConstructor
public class PatternPopulator {

    private final PatternRepository patternRepository;

    /** Any valid statistical pattern (proposed, unique pair key). */
    public PatternEntity statistical(UUID createdBy) {
        return statistical(createdBy, "pair-" + UUID.randomUUID().toString().substring(0, 8),
                PatternEntity.STATUS_PROPOSED);
    }

    public PatternEntity statistical(UUID createdBy, String pairKey, String status) {
        PatternEntity entity = new PatternEntity();
        entity.setCreatedBy(createdBy);
        entity.setKind(PatternEntity.KIND_STATISTICAL);
        entity.setPairKey(pairKey);
        entity.setCategory("physiology");
        entity.setCategoryLabel("Fiziológia");
        entity.setTitle("Alvásminőség ↔ másnapi edzés-RPE");
        entity.setMechanism("Közepes erősségű negatív együttjárás.");
        entity.setEvidence(new PatternEvidenceEnvelope(List.of("r=-0.55", "n=12 nap")));
        entity.setR(new BigDecimal("-0.5500"));
        entity.setN(12);
        entity.setP(new BigDecimal("0.064000"));
        entity.setStatus(status);
        return patternRepository.saveAndFlush(entity);
    }
}

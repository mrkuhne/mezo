package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.proactive.entity.BriefingContentEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.BriefingEntity;
import io.mrkuhne.mezo.feature.proactive.repository.BriefingRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for {@code briefing} rows (proactive B1.1). */
@TestComponent
@RequiredArgsConstructor
public class BriefingPopulator {

    private final BriefingRepository briefingRepository;

    /** Any valid briefing for the given day. */
    public BriefingEntity briefing(UUID createdBy, LocalDate briefingDate) {
        return briefing(createdBy, briefingDate, new BriefingContentEnvelope(
                "Reggeli briefing",
                List.of("Jó reggelt, Daniel!"),
                List.of(new BriefingContentEnvelope.Ref("Sleep", "regeneráció"))));
    }

    public BriefingEntity briefing(UUID createdBy, LocalDate briefingDate, BriefingContentEnvelope content) {
        BriefingEntity entity = new BriefingEntity();
        entity.setCreatedBy(createdBy);
        entity.setBriefingDate(briefingDate);
        entity.setContent(content);
        entity.setGeneratedAt(Instant.now());
        return briefingRepository.saveAndFlush(entity);
    }
}

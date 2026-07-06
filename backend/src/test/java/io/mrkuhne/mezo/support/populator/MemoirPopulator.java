package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.proactive.entity.MemoirAnchorsEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirEntity;
import io.mrkuhne.mezo.feature.proactive.repository.MemoirRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for {@code memoir} rows (proactive W2). */
@TestComponent
@RequiredArgsConstructor
public class MemoirPopulator {

    private final MemoirRepository memoirRepository;

    public MemoirEntity memoir(UUID createdBy, LocalDate weekStart) {
        MemoirEntity entity = new MemoirEntity();
        entity.setCreatedBy(createdBy);
        entity.setWeekStart(weekStart);
        entity.setTitle("Teszt memoir");
        entity.setBody("Teszt heti narratíva.");
        entity.setAnchors(new MemoirAnchorsEnvelope(
                List.of(new MemoirAnchorsEnvelope.Anchor("Memory", "2026-07-01"))));
        entity.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return memoirRepository.saveAndFlush(entity);
    }
}

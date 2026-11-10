package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.boop.entity.BoopBriefEntity;
import io.mrkuhne.mezo.feature.boop.repository.BoopBriefRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for BoopBrief (Boop S3, mezo-r36n9.7) — persisted with {@code saveAndFlush}. */
@TestComponent
@RequiredArgsConstructor
public class BoopBriefPopulator {

    private final BoopBriefRepository repository;

    public BoopBriefEntity createBrief(UUID owner, LocalDate date, String payloadJson, String inputHash) {
        BoopBriefEntity e = new BoopBriefEntity();
        e.setCreatedBy(owner);
        e.setDate(date);
        e.setPayload(payloadJson);
        e.setInputHash(inputHash);
        e.setGeneratedAt(Instant.now());
        return repository.saveAndFlush(e);
    }
}

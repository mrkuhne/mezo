package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEntity;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEvidenceEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEvidenceEnvelope.EvidenceItem;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisSuspectsEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisSuspectsEnvelope.Suspect;
import io.mrkuhne.mezo.feature.proactive.repository.DiagnosisRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for {@code diagnosis} rows (proactive, mezo-hqfi). */
@TestComponent
@RequiredArgsConstructor
public class DiagnosisPopulator {

    private final DiagnosisRepository diagnosisRepository;

    public DiagnosisEntity diagnosis(UUID createdBy) {
        return diagnosis(createdBy, Instant.now().truncatedTo(ChronoUnit.MICROS));
    }

    public DiagnosisEntity diagnosis(UUID createdBy, Instant generatedAt) {
        DiagnosisEntity entity = new DiagnosisEntity();
        entity.setCreatedBy(createdBy);
        entity.setPhenomenon(DiagnosisEntity.PHENOMENON_FATIGUE);
        entity.setWindowDays(14);
        entity.setVerdict("Teszt diagnózis.");
        entity.setConfidence("moderate");
        entity.setEvidence(new DiagnosisEvidenceEnvelope(List.of(new EvidenceItem(
                "metric", "alváshossz", "átlag 6.0 (bázis 7.5, eltérés -1.5) · 14 mért nap",
                "Alvás-napló", "SLEEP_DURATION_H", 6.0, 7.5, -1.5, 14))));
        entity.setSuspects(new DiagnosisSuspectsEnvelope(List.of(new Suspect(
                1, "Alváshiány", "Két hete napi másfél órával kevesebbet alszol.",
                List.of(0), "strong", "Feküdj le 7 napig 23:00 előtt.",
                "SLEEP_DURATION_H", "up", 7))));
        entity.setGeneratedAt(generatedAt);
        return diagnosisRepository.saveAndFlush(entity);
    }
}

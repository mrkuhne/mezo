package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEntity;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEvidenceEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEvidenceEnvelope.EvidenceItem;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisSuspectsEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisSuspectsEnvelope.Suspect;
import io.mrkuhne.mezo.feature.proactive.repository.DiagnosisRepository;
import java.time.Instant;
import java.time.LocalDate;
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

    /** The WEEK-ANCHORED {@code weight} phenomenon row (mezo-85x5r) — the reuse test's fixture. */
    public DiagnosisEntity weightDiagnosis(UUID createdBy, LocalDate anchorStart, Instant generatedAt) {
        DiagnosisEntity entity = new DiagnosisEntity();
        entity.setCreatedBy(createdBy);
        entity.setPhenomenon(DiagnosisEntity.PHENOMENON_WEIGHT);
        entity.setWindowDays(7);
        entity.setAnchorStart(anchorStart);
        entity.setVerdict("Teszt súly-diagnózis.");
        entity.setConfidence("moderate");
        entity.setEvidence(new DiagnosisEvidenceEnvelope(List.of(new EvidenceItem(
                "metric", "súlyváltozás", "átlag -0.3 · 7 mért nap",
                "Reggeli mérlegelés", "WEIGHT_DELTA_KG", -0.3, null, null, 7))));
        entity.setSuspects(new DiagnosisSuspectsEnvelope(List.of(new Suspect(
                1, "Napi só", "A hét folyamán a sóbevitel megugrott.",
                List.of(0), "moderate", "Csökkentsd a sót 7 napig.",
                "DAILY_SALT_G", "down", 7))));
        entity.setGeneratedAt(generatedAt);
        return diagnosisRepository.saveAndFlush(entity);
    }
}

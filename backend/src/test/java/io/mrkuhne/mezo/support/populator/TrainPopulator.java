package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.ProvenanceEnvelope;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Test data factory for the Train aggregate (mesocycle + per-muscle volume log) — see
 * docs/references/integration_test_framework.md (one populator per aggregate). Persists via
 * repository {@code saveAndFlush} so DB constraints fire.
 */
@TestComponent
@RequiredArgsConstructor
public class TrainPopulator {

    private final MesocycleRepository mesocycleRepository;
    private final MuscleGroupVolumeLogRepository volumeLogRepository;

    public MesocycleEntity createMesocycle(UUID createdBy, String title, String status) {
        MesocycleEntity m = new MesocycleEntity();
        m.setCreatedBy(createdBy);
        m.setTitle(title);
        m.setShortTitle(title);
        m.setStatus(status);
        m.setStartDate(LocalDate.parse("2026-05-01"));
        m.setEndDate(LocalDate.parse("2026-06-12"));
        m.setWeeks(6);
        m.setCurrentWeek(3);
        m.setSplit("Pull / Push / Legs · 5×/hét");
        m.setStyle("RP · 6 hét");
        m.setPhaseCurve(new String[] {"MEV", "MAV", "Deload"});
        m.setVolumeRecompute(new VolumeRecomputeJson("Vasárnap", "Vasárnap", "batch",
            List.of(new VolumeRecomputeJson.Change("back", "MRV +2", "stabil", null))));
        return mesocycleRepository.saveAndFlush(m);
    }

    public MuscleGroupVolumeLogEntity createVolumeLog(UUID createdBy, UUID mesocycleId, String muscle) {
        MuscleGroupVolumeLogEntity v = new MuscleGroupVolumeLogEntity();
        v.setCreatedBy(createdBy);
        v.setMesocycleId(mesocycleId);
        v.setMuscle(muscle);
        v.setMev(8);
        v.setMav(14);
        v.setMrv(20);
        v.setCurrentSets(14);
        v.setSource(new ProvenanceEnvelope(
            new ProvenanceEnvelope.Baseline("RP guidelines · intermediate", 8, 12, 18),
            List.of(new ProvenanceEnvelope.Adjustment("pattern", "test", Map.of("mrv", 2), null)),
            0.78, null, null));
        return volumeLogRepository.saveAndFlush(v);
    }
}

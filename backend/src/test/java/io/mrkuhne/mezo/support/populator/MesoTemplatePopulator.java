package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.train.entity.MesoTemplateEntity;
import io.mrkuhne.mezo.feature.train.entity.json.GymExerciseJson;
import io.mrkuhne.mezo.feature.train.entity.json.MesoDayJson;
import io.mrkuhne.mezo.feature.train.entity.json.VolumeBaselineJson;
import io.mrkuhne.mezo.feature.train.repository.MesoTemplateRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Test data factory for {@link MesoTemplateEntity} — see
 * docs/references/integration_test_framework.md (one populator per aggregate). Persists via
 * repository {@code saveAndFlush} so DB constraints fire.
 */
@TestComponent
@RequiredArgsConstructor
public class MesoTemplatePopulator {

    private final MesoTemplateRepository mesoTemplateRepository;

    /** Fixed deterministic 2-day / 2-exercise-per-day template with a chest/back volume baseline. */
    public MesoTemplateEntity template(UUID createdBy) {
        MesoTemplateEntity t = new MesoTemplateEntity();
        t.setCreatedBy(createdBy);
        t.setTitle("Sablon A");
        t.setShortTitle("Sablon A");
        t.setWeeks(4);
        t.setSplit("Push / Pull");
        t.setStyle("RP · 4 hét");
        t.setPhaseCurve(List.of("MEV", "MAV", "MRV", "Deload"));
        t.setDays(List.of(
            new MesoDayJson("Hét", "gym", "chest", false, null,
                List.of(
                    exercise("Bench Press", "chest", 2),
                    exercise("Incline Bench Press", "chest", 1))),
            new MesoDayJson("Csüt", "gym", "back", false, null,
                List.of(
                    exercise("Row", "back", 2),
                    exercise("Lat Pulldown", "back", 1)))
        ));
        t.setVolumePerMuscle(Map.of(
            "chest", new VolumeBaselineJson("RP guidelines · intermediate", 8, 14, 20),
            "back", new VolumeBaselineJson("RP guidelines · intermediate", 10, 16, 22)
        ));
        return mesoTemplateRepository.saveAndFlush(t);
    }

    /** A stored recipe with a server-synthesized id — what create/update mints for every exercise. */
    private static GymExerciseJson exercise(String name, String muscle, int warmupSets) {
        return new GymExerciseJson(UUID.randomUUID(), name, muscle, warmupSets, 3, 8, 12, 2, null,
            "compound", null, null, null);
    }
}

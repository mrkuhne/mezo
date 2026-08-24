package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.json.GymExerciseJson;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import tools.jackson.databind.ObjectMapper;

/**
 * mezo-gbo7: a plan document written BEFORE the flag existed must still read back as counting,
 * so the migration and old jsonb both deserialize without nulls leaking into the volume math.
 */
class MesoTemplateVolumeFlagIT extends AbstractIntegrationTest {

    @Autowired ObjectMapper objectMapper;

    @Test
    void testGymExerciseJson_shouldDefaultToCounting_whenFieldAbsentFromStoredDocument() throws Exception {
        String legacy = """
            {"id":"0f6d6b4e-3f4a-4a1e-8f34-2b5f7f5d1c11","name":"Pull-Up","muscle":"back-wide",
             "warmupSets":2,"workingSets":3,"repMin":6,"repMax":8,"targetRir":0,
             "anchorWeightKg":null,"type":"compound","warning":null,"catalogId":null}
            """;

        GymExerciseJson parsed = objectMapper.readValue(legacy, GymExerciseJson.class);

        assertThat(parsed.countsTowardVolume()).isTrue();
    }

    @Test
    void testGymExerciseJson_shouldKeepFalse_whenDocumentExemptsTheExercise() throws Exception {
        String exempt = """
            {"id":"0f6d6b4e-3f4a-4a1e-8f34-2b5f7f5d1c12","name":"Dead Hang","muscle":"back-wide",
             "warmupSets":0,"workingSets":2,"repMin":45,"repMax":60,"targetRir":0,
             "anchorWeightKg":null,"type":"plyo","warning":null,"catalogId":null,
             "countsTowardVolume":false}
            """;

        assertThat(objectMapper.readValue(exempt, GymExerciseJson.class).countsTowardVolume()).isFalse();
    }
}

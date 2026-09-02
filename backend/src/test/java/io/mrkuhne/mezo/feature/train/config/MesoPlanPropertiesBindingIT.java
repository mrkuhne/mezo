package io.mrkuhne.mezo.feature.train.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class MesoPlanPropertiesBindingIT extends AbstractIntegrationTest {

    @Autowired
    private MesoPlanProperties props;

    @Test
    void testBinding_shouldExposeDefaults_whenYmlLoaded() {
        assertThat(props.maxExercisesPerGroupPerDay()).isEqualTo(2);
        assertThat(props.compoundRepMin()).isEqualTo(8);
        assertThat(props.compoundRepMax()).isEqualTo(10);
        assertThat(props.isolationRepMin()).isEqualTo(12);
        assertThat(props.isolationRepMax()).isEqualTo(15);
        assertThat(props.targetRir()).isEqualTo(1);
        assertThat(props.compoundWarmup()).isEqualTo(2);
        assertThat(props.isolationWarmup()).isEqualTo(1);
    }
}

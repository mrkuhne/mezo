package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.config.YearPlanProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class YearPlanPropertiesBindingIT extends AbstractIntegrationTest {

    @Autowired YearPlanProperties props;
    @Autowired VolumeProperties volume;

    @Test
    void testProperties_shouldBind_whenApplicationYmlLoaded() {
        assertThat(props.yearWeeks()).isEqualTo(52);
        assertThat(props.defaultBlockWeeks()).isEqualTo(6);
        assertThat(props.defaultConsolidationWeeks()).isEqualTo(2);
        assertThat(props.lateToleranceDays()).isEqualTo(3);
        assertThat(props.linkWindowDays()).isEqualTo(14);
        assertThat(props.pairs()).hasSize(11);
    }

    @Test
    void testKindGroups_shouldEqualVolumeBaselines_whenBound() {
        Set<String> union = new HashSet<>();
        props.kindGroups().values().forEach(union::addAll);

        assertThat(union).isEqualTo(volume.baselines().keySet());
    }
}

package io.mrkuhne.mezo.feature.season;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.season.service.SeasonDayKind;
import org.junit.jupiter.api.Test;

/** mezo-r36n9.131: a day can carry a training session, a sport session, both, or neither. */
class SeasonDayKindTest {

    @Test
    void fourKindsWithTheMenuPlannersKeys() {
        assertThat(SeasonDayKind.of(true, false).key()).isEqualTo("edzesnap");
        assertThat(SeasonDayKind.of(false, true).key()).isEqualTo("sport");
        assertThat(SeasonDayKind.of(true, true).key()).isEqualTo("edzes_sport");
        assertThat(SeasonDayKind.of(false, false).key()).isEqualTo("pihenonap");
    }

    @Test
    void hungarianLabels() {
        assertThat(SeasonDayKind.TRAINING_SPORT.labelHu()).isEqualTo("edzés + sport nap");
        assertThat(SeasonDayKind.REST.labelHu()).isEqualTo("pihenőnap");
    }
}

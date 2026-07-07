package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ExerciseRecordResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.service.ExerciseRecordService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class WarmupExclusionIT extends AbstractIntegrationTest {

    @Autowired ExerciseRecordService records;
    @Autowired TrainPopulator train;

    @Test
    void testRecords_shouldExcludeWarmupSets_fromBestSet() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Kedd");
        ExerciseEntity ex = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        // a heavier warmup (100kg) must NOT be the best set; the working 80×8 is the record
        train.completedInstanceWithSets(owner, day.getId(), ex.getId(), sets -> {
            sets.add(train.set("warmup", BigDecimal.valueOf(100), 5, 4));
            sets.add(train.set("working", BigDecimal.valueOf(80), 8, 0));
        });

        List<ExerciseRecordResponse> res = records.list(owner);

        assertThat(res).hasSize(1);
        assertThat(res.get(0).getBestSet().getWeightKg()).isEqualByComparingTo(BigDecimal.valueOf(80));
        assertThat(res.get(0).getTotalSets()).isEqualTo(1); // only the working set counts
    }

    /** Find-or-create yields the demodata-seeded owner's id — the single-user principal. */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Autowired private io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @Autowired private io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;
}

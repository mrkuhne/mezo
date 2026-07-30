package io.mrkuhne.mezo.feature.biometrics.sleep;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.Hypnogram;
import io.mrkuhne.mezo.api.dto.LogSleepRequest;
import io.mrkuhne.mezo.api.dto.SleepLogResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepLogService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class SleepLogHypnogramIT extends AbstractIntegrationTest {

    @Autowired
    private SleepLogService sleepLogService;

    @Autowired
    private UserPopulator userPopulator;

    @Test
    void testLog_shouldRoundTripHypnogramAsTypedJsonb_whenProvided() {
        UUID userId = userPopulator.createUser().getId();
        LogSleepRequest req = LogSleepRequest.builder()
            .date(LocalDate.of(2026, 7, 30))
            .hypnogram(Hypnogram.builder().bucketMin(15).stages("ALDDLRR").build())
            .build();

        sleepLogService.log(userId, req);

        List<SleepLogResponse> rows = sleepLogService.list(userId);
        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().getHypnogram()).isNotNull();
        assertThat(rows.getFirst().getHypnogram().getBucketMin()).isEqualTo(15);
        assertThat(rows.getFirst().getHypnogram().getStages()).isEqualTo("ALDDLRR");
    }

    @Test
    void testLog_shouldLeaveHypnogramNull_whenOmitted() {
        UUID userId = userPopulator.createUser().getId();
        LogSleepRequest req = LogSleepRequest.builder()
            .date(LocalDate.of(2026, 7, 30))
            .build();

        sleepLogService.log(userId, req);

        assertThat(sleepLogService.list(userId).getFirst().getHypnogram()).isNull();
    }
}

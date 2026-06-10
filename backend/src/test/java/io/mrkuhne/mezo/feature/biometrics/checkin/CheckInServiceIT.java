package io.mrkuhne.mezo.feature.biometrics.checkin;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.biometrics.checkin.dto.SaveCheckInRequest;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class CheckInServiceIT extends AbstractIntegrationTest {

    @Autowired private CheckInService service;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testSave_shouldUpsertSameSlot_whenSavedTwice() {
        UUID user = databasePopulator.populateUser("a@test.local");
        LocalDate day = LocalDate.parse("2026-06-01");
        service.save(user, new SaveCheckInRequest(day, "09:00", "done", 7, 4, 6, 8, null));
        service.save(user, new SaveCheckInRequest(day, "09:00", "done", 8, 3, 7, 9, "better"));

        var rows = service.listForDay(user, day);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).energy()).isEqualTo(8);
        assertThat(rows.get(0).note()).isEqualTo("better");
    }
}

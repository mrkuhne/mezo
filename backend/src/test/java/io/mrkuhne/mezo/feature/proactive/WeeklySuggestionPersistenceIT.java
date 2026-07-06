package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.proactive.entity.WeeklySuggestionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.WeeklySuggestionRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeeklySuggestionPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** weekly_suggestion round-trip + the one-live-row-per-week partial-unique contract. */
@Transactional
class WeeklySuggestionPersistenceIT extends AbstractIntegrationTest {

    private static final LocalDate MONDAY = LocalDate.of(2026, 7, 6);

    @Autowired private WeeklySuggestionRepository weeklySuggestionRepository;
    @Autowired private WeeklySuggestionPopulator weeklySuggestionPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testSave_shouldRoundTrip_whenReloaded() {
        UUID user = userPopulator.createUser("ws-rt@test.local").getId();
        WeeklySuggestionEntity saved = weeklySuggestionPopulator.suggestion(user, MONDAY);

        assertThat(weeklySuggestionRepository.findByCreatedByAndWeekStart(user, MONDAY))
                .hasValueSatisfying(s -> {
                    assertThat(s.getId()).isEqualTo(saved.getId());
                    assertThat(s.getProse()).isEqualTo("Heti tervjavaslat teszt.");
                    assertThat(s.getGeneratedAt()).isNotNull();
                });
    }

    @Test
    void testSave_shouldRejectSecondLiveRowForSameWeek_whenUniqueIndexHolds() {
        UUID user = userPopulator.createUser("ws-uq@test.local").getId();
        weeklySuggestionPopulator.suggestion(user, MONDAY);

        assertThatThrownBy(() -> weeklySuggestionPopulator.suggestion(user, MONDAY))
                .hasMessageContaining("uq_weekly_suggestion_created_by_week_start");
    }

    @Test
    void testFindByCreatedByAndWeekStart_shouldReturnEmpty_whenOtherUsersRow() {
        UUID owner = userPopulator.createUser("ws-own@test.local").getId();
        UUID other = userPopulator.createUser("ws-other@test.local").getId();
        weeklySuggestionPopulator.suggestion(other, MONDAY);

        assertThat(weeklySuggestionRepository.findByCreatedByAndWeekStart(owner, MONDAY)).isEmpty();
    }
}

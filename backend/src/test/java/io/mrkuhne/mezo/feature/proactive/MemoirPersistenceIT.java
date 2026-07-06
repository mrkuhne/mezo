package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.proactive.entity.MemoirAnchorsEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirEntity;
import io.mrkuhne.mezo.feature.proactive.repository.MemoirRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoirPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** memoir jsonb-envelope round-trip + one-live-row-per-week + latest-first finder. */
@Transactional
class MemoirPersistenceIT extends AbstractIntegrationTest {

    private static final LocalDate MONDAY = LocalDate.of(2026, 6, 29);

    @Autowired private MemoirRepository memoirRepository;
    @Autowired private MemoirPopulator memoirPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testSave_shouldRoundTripAnchorsEnvelope_whenReloaded() {
        UUID user = userPopulator.createUser("memoir-rt@test.local").getId();
        MemoirEntity saved = memoirPopulator.memoir(user, MONDAY);

        assertThat(memoirRepository.findByCreatedByAndWeekStart(user, MONDAY))
                .hasValueSatisfying(m -> {
                    assertThat(m.getId()).isEqualTo(saved.getId());
                    assertThat(m.getTitle()).isEqualTo("Teszt memoir");
                    assertThat(m.getAnchors().anchors())
                            .containsExactly(new MemoirAnchorsEnvelope.Anchor("Memory", "2026-07-01"));
                });
    }

    @Test
    void testSave_shouldRejectSecondLiveRowForSameWeek_whenUniqueIndexHolds() {
        UUID user = userPopulator.createUser("memoir-uq@test.local").getId();
        memoirPopulator.memoir(user, MONDAY);

        assertThatThrownBy(() -> memoirPopulator.memoir(user, MONDAY))
                .hasMessageContaining("uq_memoir_created_by_week_start");
    }

    @Test
    void testFindFirstByCreatedByOrderByWeekStartDesc_shouldReturnLatestOwnRow() {
        UUID owner = userPopulator.createUser("memoir-latest@test.local").getId();
        UUID other = userPopulator.createUser("memoir-foreign@test.local").getId();
        memoirPopulator.memoir(owner, MONDAY.minusWeeks(1));
        MemoirEntity latest = memoirPopulator.memoir(owner, MONDAY);
        memoirPopulator.memoir(other, MONDAY.plusWeeks(1));

        assertThat(memoirRepository.findFirstByCreatedByOrderByWeekStartDesc(owner))
                .hasValueSatisfying(m -> assertThat(m.getId()).isEqualTo(latest.getId()));
    }
}

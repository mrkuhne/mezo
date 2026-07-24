package io.mrkuhne.mezo.feature.gamification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.gamification.repository.GamificationProfileRepository;
import io.mrkuhne.mezo.feature.gamification.repository.OwnedTitleRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.GamificationPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

/** gamification_profile + coin_event DDL: profile round-trip, soft-delete hide, coin-event idempotency (mezo-huzd). */
class GamificationEntityIT extends AbstractIntegrationTest {

    @Autowired private UserPopulator userPopulator;
    @Autowired private GamificationPopulator gamificationPopulator;
    @Autowired private GamificationProfileRepository gamificationProfileRepository;
    @Autowired private OwnedTitleRepository ownedTitleRepository;

    private UUID ownerId() {
        return userPopulator.createUser("gami-a@test.hu").getId();
    }

    @Test
    void testFindByCreatedBy_shouldRoundTrip_whenProfileSaved() {
        UUID owner = ownerId();
        var saved = gamificationPopulator.profile(owner, 120, 5, 1, LocalDate.now());

        assertThat(gamificationProfileRepository.findByCreatedBy(owner))
            .hasValueSatisfying(p -> {
                assertThat(p.getId()).isEqualTo(saved.getId());
                assertThat(p.getCoins()).isEqualTo(120);
                assertThat(p.getStreakDays()).isEqualTo(5);
                assertThat(p.getStreakSavers()).isEqualTo(1);
                assertThat(p.getLastStreakDate()).isEqualTo(LocalDate.now());
                assertThat(p.getEquippedTitleKey()).isEqualTo("ujonc");
                assertThat(p.getAccountLevel()).isEqualTo(1);
            });
    }

    @Test
    void testFindByCreatedBy_shouldHideProfile_whenSoftDeleted() {
        UUID owner = ownerId();
        var saved = gamificationPopulator.profile(owner, 0, 0, 0, null);
        gamificationProfileRepository.delete(saved);

        assertThat(gamificationProfileRepository.findByCreatedBy(owner)).isEmpty();
    }

    @Test
    void testCoinEvent_shouldRejectDuplicate_whenSameReasonAndRef() {
        gamificationPopulator.coinEvent(ownerId(), "quest", 10, "q-1", LocalDate.now());
        assertThatThrownBy(() ->
            gamificationPopulator.coinEvent(ownerId(), "quest", 10, "q-1", LocalDate.now()))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void testOwnedTitle_shouldStampAcquiredAt_whenNotSet() {
        UUID owner = ownerId();
        var saved = gamificationPopulator.ownedTitle(owner, "premium");

        assertThat(ownedTitleRepository.findById(saved.getId()))
            .hasValueSatisfying(title -> {
                assertThat(title.getTitleKey()).isEqualTo("premium");
                assertThat(title.getAcquiredAt()).isNotNull();
            });
    }
}

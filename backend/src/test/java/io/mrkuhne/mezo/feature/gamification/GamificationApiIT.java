package io.mrkuhne.mezo.feature.gamification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GamificationDayResponse;
import io.mrkuhne.mezo.api.dto.GamificationProfileResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.gamification.repository.CoinEventRepository;
import io.mrkuhne.mezo.feature.progression.habit.HabitSignal;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.GamificationPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * /api/gamification HTTP surface (bd mezo-huzd): profile/day reads (ghost zeros + real-award
 * reflection) and the title-shop/streak-saver purchase mutations, including every error branch
 * from the behavior contract (clauses 1, 2, 4, 5, 6).
 */
class GamificationApiIT extends ApiIntegrationTest {

    @Autowired private ProgressionService progressionService;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private GamificationPopulator gamificationPopulator;
    @Autowired private CoinEventRepository coinEventRepository;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    // ==== clause 1: profile read ====

    @Test
    void testGetGamificationProfile_shouldReturnGhostZeros_whenNoProfileRow() {
        GamificationProfileResponse res = getForBody("/api/gamification/profile",
            ownerAuthHeaders(), HttpStatus.OK, GamificationProfileResponse.class);

        assertThat(res.getTotalXp()).isZero();
        assertThat(res.getLevel()).isEqualTo(1);
        assertThat(res.getXpInLevel()).isZero();
        assertThat(res.getCoins()).isZero();
        assertThat(res.getStreakDays()).isZero();
        assertThat(res.getStreakAlive()).isFalse();
        assertThat(res.getStreakSavers()).isZero();
        assertThat(res.getEquippedTitleKey()).isEqualTo(TitleCatalog.DEFAULT_TITLE_KEY);
        assertThat(res.getOwnedTitleKeys()).isEmpty();
    }

    @Test
    void testGetGamificationProfile_shouldReflectAward_whenOneHabitApplied() {
        UUID owner = ownerId();
        progressionService.applyHabit(owner,
            new HabitSignal(UUID.randomUUID(), "mindset", 10, "Napzárás", LocalDate.now()));

        GamificationProfileResponse res = getForBody("/api/gamification/profile",
            ownerAuthHeaders(), HttpStatus.OK, GamificationProfileResponse.class);

        assertThat(res.getTotalXp()).isEqualTo(10L);
        assertThat(res.getLevel()).isEqualTo(1);
    }

    // ==== clause 2: day read ====

    @Test
    void testGetGamificationDay_shouldAggregateXpBySource_whenOneHabitApplied() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        progressionService.applyHabit(owner,
            new HabitSignal(UUID.randomUUID(), "mindset", 10, "Napzárás", today));

        GamificationDayResponse res = getForBody("/api/gamification/day/" + today,
            ownerAuthHeaders(), HttpStatus.OK, GamificationDayResponse.class);

        assertThat(res.getXpBySource()).hasSize(1);
        assertThat(res.getXpBySource().getFirst().getSource()).isEqualTo("HABIT");
        assertThat(res.getXpBySource().getFirst().getXp()).isEqualTo(10L);
        assertThat(res.getXpTotal()).isEqualTo(10L);
    }

    @Test
    void testGetGamificationDay_shouldReturnHonestZeros_whenNothingHappened() {
        GamificationDayResponse res = getForBody("/api/gamification/day/" + LocalDate.now(),
            ownerAuthHeaders(), HttpStatus.OK, GamificationDayResponse.class);

        assertThat(res.getXpBySource()).isEmpty();
        assertThat(res.getXpTotal()).isZero();
        assertThat(res.getCoinEvents()).isEmpty();
        assertThat(res.getCoinTotal()).isZero();
    }

    // ==== clause 4: buyTitle ====

    @Test
    void testBuyTitle_shouldSpendAndAutoEquip_whenShopTitleAffordable() {
        UUID owner = ownerId();
        gamificationPopulator.profile(owner, 200, 0, 0, null);

        GamificationProfileResponse res = postForBody("/api/gamification/title/kezdo-kanal/buy", null,
            ownerAuthHeaders(), HttpStatus.OK, GamificationProfileResponse.class);

        assertThat(res.getCoins()).isEqualTo(100); // 200 - 100 (kezdo-kanal price)
        assertThat(res.getOwnedTitleKeys()).contains("kezdo-kanal");
        assertThat(res.getEquippedTitleKey()).isEqualTo("kezdo-kanal");
        assertThat(coinEventRepository.existsByCreatedByAndReasonAndSourceRefId(
            owner, "purchase", "buy-kezdo-kanal")).isTrue();
    }

    @Test
    void testBuyTitle_shouldReturn404_whenTitleUnknown() {
        String err = postForBody("/api/gamification/title/nincs-ilyen/buy", null,
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(err, "GAMIFICATION_TITLE_UNKNOWN");
    }

    @Test
    void testBuyTitle_shouldReturn409_whenLadderTitle() {
        String err = postForBody("/api/gamification/title/lendulet/buy", null,
            ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(err, "GAMIFICATION_TITLE_NOT_SHOP");
    }

    @Test
    void testBuyTitle_shouldReturn409_whenAlreadyOwned() {
        UUID owner = ownerId();
        gamificationPopulator.profile(owner, 500, 0, 0, null);
        gamificationPopulator.ownedTitle(owner, "kezdo-kanal");

        String err = postForBody("/api/gamification/title/kezdo-kanal/buy", null,
            ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(err, "GAMIFICATION_TITLE_OWNED");
    }

    @Test
    void testBuyTitle_shouldReturn409_whenCoinsInsufficient() {
        UUID owner = ownerId();
        gamificationPopulator.profile(owner, 0, 0, 0, null);

        String err = postForBody("/api/gamification/title/kezdo-kanal/buy", null,
            ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(err, "GAMIFICATION_COINS_INSUFFICIENT");
    }

    // ==== clause 5: equipTitle ====

    @Test
    void testEquipTitle_shouldReturn404_whenTitleUnknown() {
        String err = postForBody("/api/gamification/title/nincs-ilyen/equip", null,
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(err, "GAMIFICATION_TITLE_UNKNOWN");
    }

    @Test
    void testEquipTitle_shouldReturn409_whenLadderBelowLevel() {
        // "lendulet" unlockLevel=3; a fresh owner with no XP is account level 1.
        String err = postForBody("/api/gamification/title/lendulet/equip", null,
            ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(err, "GAMIFICATION_TITLE_LOCKED");
    }

    @Test
    void testEquipTitle_shouldReturn409_whenShopTitleNotOwned() {
        String err = postForBody("/api/gamification/title/kezdo-kanal/equip", null,
            ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(err, "GAMIFICATION_TITLE_LOCKED");
    }

    @Test
    void testEquipTitle_shouldSucceed_whenLadderTitleUnlockedByLevel() {
        UUID owner = ownerId();
        // Lv1→2 costs 80 XP, Lv2→3 costs 120 XP (AccountLevelCurve): 200 XP lands exactly at Lv3.
        progressionService.applyHabit(owner,
            new HabitSignal(UUID.randomUUID(), "mindset", 200, "Nagy löket", LocalDate.now()));

        GamificationProfileResponse res = postForBody("/api/gamification/title/lendulet/equip", null,
            ownerAuthHeaders(), HttpStatus.OK, GamificationProfileResponse.class);

        assertThat(res.getEquippedTitleKey()).isEqualTo("lendulet");
    }

    // ==== clause 6: buySaver ====

    @Test
    void testBuySaver_shouldReturn409_whenCoinsInsufficient() {
        UUID owner = ownerId();
        gamificationPopulator.profile(owner, 0, 0, 0, null);

        String err = postForBody("/api/gamification/saver/buy", null,
            ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(err, "GAMIFICATION_COINS_INSUFFICIENT");
    }

    @Test
    void testBuySaver_shouldReturn409_whenAtLimit() {
        UUID owner = ownerId();
        gamificationPopulator.profile(owner, 1000, 0, 2, null);

        String err = postForBody("/api/gamification/saver/buy", null,
            ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(err, "GAMIFICATION_SAVER_LIMIT");
    }

    @Test
    void testBuySaver_shouldSucceed_whenAffordableAndBelowLimit() {
        UUID owner = ownerId();
        gamificationPopulator.profile(owner, 500, 0, 0, null);

        GamificationProfileResponse res = postForBody("/api/gamification/saver/buy", null,
            ownerAuthHeaders(), HttpStatus.OK, GamificationProfileResponse.class);

        assertThat(res.getCoins()).isEqualTo(300); // 500 - 200 (saver price)
        assertThat(res.getStreakSavers()).isEqualTo(1);
        assertThat(coinEventRepository.findByCreatedByAndOccurredOnOrderByCreatedAtAsc(owner, LocalDate.now()))
            .anySatisfy(e -> {
                assertThat(e.getReason()).isEqualTo("purchase");
                assertThat(e.getAmount()).isEqualTo(-200);
            });
    }
}

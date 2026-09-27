package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ReadinessChoiceRequest;
import io.mrkuhne.mezo.api.dto.ReadinessReason;
import io.mrkuhne.mezo.api.dto.ReadinessTodayResponse;
import io.mrkuhne.mezo.api.dto.ReadinessTodayResponse.StateEnum;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.PainRegion;
import io.mrkuhne.mezo.feature.train.entity.ReadinessChoiceEntity.Choice;
import io.mrkuhne.mezo.feature.train.repository.ReadinessChoiceRepository;
import io.mrkuhne.mezo.feature.train.service.ReadinessService;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.ReadinessChoicePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** Check-in 2.0 training readiness (mezo-ck2, spec 2026-09-27 §3.3) — the service read + choice. */
@Transactional
class ReadinessServiceIT extends AbstractIntegrationTest {

    @Autowired ReadinessService readinessService;
    @Autowired ReadinessChoiceRepository choiceRepository;
    @Autowired CheckInPopulator checkIns;
    @Autowired TrainPopulator train;
    @Autowired ReadinessChoicePopulator choices;
    @Autowired UserPopulator users;

    private static final LocalDate TODAY = LocalDate.now();

    /** An active meso with today's template day carrying a rear-delt and a lat exercise. */
    private void gymToday(UUID owner) {
        var meso = train.createActiveMeso(owner);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(TODAY.getDayOfWeek().getValue() - 1);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel);
        train.createExercise(owner, day.getId(), "Rear Delt Fly", 0, "shoulder-rear", "isolation", null);
        train.createExercise(owner, day.getId(), "Lat Pulldown", 1, "back-wide", "compound", null);
    }

    @Test
    void testToday_shouldReturnNone_whenNoMorningCheckIn() {
        UUID owner = ownerId();
        gymToday(owner);

        ReadinessTodayResponse res = readinessService.today(owner);

        assertThat(res.getState()).isEqualTo(StateEnum.NONE);
        assertThat(res.getSuggest()).isFalse();
        assertThat(res.getReasons()).isEmpty();
        assertThat(res.getCare()).isEmpty();
    }

    @Test
    void testToday_shouldOfferWithReasonsInOrder_whenSorenessAtThreshold() {
        UUID owner = ownerId();
        gymToday(owner);
        checkIns.createCheckIn(owner, TODAY, "06:30", c -> {
            c.setMotivation(5);
            c.setRested(6);
            c.setSoreness(7);
        });

        ReadinessTodayResponse res = readinessService.today(owner);

        assertThat(res.getSuggest()).isTrue();
        assertThat(res.getState()).isEqualTo(StateEnum.OFFER);
        assertThat(res.getReasons()).extracting(ReadinessReason::getItem, ReadinessReason::getValue)
            .containsExactly(
                org.assertj.core.groups.Tuple.tuple(ReadinessReason.ItemEnum.RESTED, 6),
                org.assertj.core.groups.Tuple.tuple(ReadinessReason.ItemEnum.SORENESS, 7),
                org.assertj.core.groups.Tuple.tuple(ReadinessReason.ItemEnum.MOTIVATION, 5));
    }

    @Test
    void testToday_shouldSuggest_whenRestedOrMotivationAtThreshold() {
        UUID owner = ownerId();
        gymToday(owner);
        checkIns.createCheckIn(owner, TODAY, "06:30", c -> c.setRested(4));
        assertThat(readinessService.today(owner).getSuggest()).isTrue();

        UUID other = users.createUser().getId();
        checkIns.createCheckIn(other, TODAY, "06:30", c -> c.setMotivation(3));
        assertThat(readinessService.today(other).getSuggest()).isTrue();
    }

    @Test
    void testToday_shouldNotSuggest_whenEveryValueJustInsideThresholds() {
        UUID owner = ownerId();
        gymToday(owner);
        checkIns.createCheckIn(owner, TODAY, "06:30", c -> {
            c.setRested(5);
            c.setSoreness(6);
            c.setMotivation(4);
        });

        ReadinessTodayResponse res = readinessService.today(owner);

        assertThat(res.getSuggest()).isFalse();
        assertThat(res.getState()).isEqualTo(StateEnum.NONE);
        assertThat(res.getReasons()).hasSize(3);
    }

    @Test
    void testToday_shouldPreferMorningSlot_whenAnEarlierCheckInExists() {
        UUID owner = ownerId();
        gymToday(owner);
        checkIns.createCheckIn(owner, TODAY, "05:00", c -> c.setRested(2));
        checkIns.createCheckIn(owner, TODAY, "06:30", c -> c.setRested(8));

        ReadinessTodayResponse res = readinessService.today(owner);

        assertThat(res.getSuggest()).isFalse();
        assertThat(res.getReasons()).extracting(ReadinessReason::getValue).containsExactly(8);
    }

    @Test
    void testToday_shouldFallBackToFirstAnsweringCheckIn_whenNoMorningSlotAnswered() {
        UUID owner = ownerId();
        gymToday(owner);
        checkIns.createCheckIn(owner, TODAY, "06:30", c -> c.setEnergy(7)); // no readiness item
        checkIns.createCheckIn(owner, TODAY, "10:00", c -> c.setSoreness(8));
        checkIns.createCheckIn(owner, TODAY, "14:00", c -> c.setSoreness(2));

        ReadinessTodayResponse res = readinessService.today(owner);

        assertThat(res.getSuggest()).isTrue();
        assertThat(res.getReasons()).extracting(ReadinessReason::getValue).containsExactly(8);
    }

    @Test
    void testToday_shouldListCareExercise_whenPainRegionLoadsIt() {
        UUID owner = ownerId();
        gymToday(owner);
        checkIns.createCheckIn(owner, TODAY, "06:30", c -> {
            c.setRested(7);
            c.setPain(true);
            c.setPainRegions(List.of(PainRegion.VALL));
            c.setPainIntensity(5);
        });

        ReadinessTodayResponse res = readinessService.today(owner);

        // Pain alone offers the card (no threshold fired).
        assertThat(res.getSuggest()).isFalse();
        assertThat(res.getState()).isEqualTo(StateEnum.OFFER);
        assertThat(res.getCare()).singleElement().satisfies(c -> {
            assertThat(c.getExerciseName()).isEqualTo("Rear Delt Fly");
            assertThat(c.getRegion()).isEqualTo("VALL");
            assertThat(c.getRegionLabel()).isEqualTo("vállad");
            assertThat(c.getIntensity()).isEqualTo(5);
        });
    }

    @Test
    void testToday_shouldListNoCare_whenPainAnsweredNo() {
        UUID owner = ownerId();
        gymToday(owner);
        checkIns.createCheckIn(owner, TODAY, "06:30", c -> {
            c.setSoreness(8);
            c.setPain(false);
        });

        assertThat(readinessService.today(owner).getCare()).isEmpty();
    }

    @Test
    void testToday_shouldReturnNone_whenNoGymPlannedToday() {
        UUID owner = ownerId();
        checkIns.createCheckIn(owner, TODAY, "06:30", c -> c.setSoreness(9));

        ReadinessTodayResponse res = readinessService.today(owner);

        assertThat(res.getSuggest()).isTrue();
        assertThat(res.getState()).isEqualTo(StateEnum.NONE);
    }

    @Test
    void testToday_shouldIgnoreAnotherUsersCheckInAndChoice_whenReadingOwner() {
        UUID owner = ownerId();
        gymToday(owner);
        UUID other = users.createUser().getId();
        checkIns.createCheckIn(other, TODAY, "06:30", c -> c.setSoreness(9));
        choices.createChoice(other, TODAY, Choice.KEEP);

        ReadinessTodayResponse res = readinessService.today(owner);

        assertThat(res.getState()).isEqualTo(StateEnum.NONE);
        assertThat(res.getReasons()).isEmpty();
    }

    @Test
    void testChoose_shouldStoreOneRowAndReportState_whenCalledRepeatedly() {
        UUID owner = ownerId();
        gymToday(owner);
        checkIns.createCheckIn(owner, TODAY, "06:30", c -> c.setSoreness(8));

        ReadinessTodayResponse lightened = readinessService.choose(owner, request(ReadinessChoiceRequest.ChoiceEnum.LIGHTEN));
        readinessService.choose(owner, request(ReadinessChoiceRequest.ChoiceEnum.LIGHTEN));

        assertThat(lightened.getState()).isEqualTo(StateEnum.LIGHTENED);
        assertThat(choiceRepository.findAll()).hasSize(1);

        ReadinessTodayResponse kept = readinessService.choose(owner, request(ReadinessChoiceRequest.ChoiceEnum.KEEP));
        assertThat(kept.getState()).isEqualTo(StateEnum.KEPT);
        assertThat(choiceRepository.findAll()).hasSize(1);
    }

    @Test
    void testUndo_shouldReturnToOffer_whenChoiceExists() {
        UUID owner = ownerId();
        gymToday(owner);
        checkIns.createCheckIn(owner, TODAY, "06:30", c -> c.setSoreness(8));
        readinessService.choose(owner, request(ReadinessChoiceRequest.ChoiceEnum.LIGHTEN));

        ReadinessTodayResponse res = readinessService.undo(owner);

        assertThat(res.getState()).isEqualTo(StateEnum.OFFER);
        // Idempotent: a second undo with nothing stored is a no-op.
        assertThat(readinessService.undo(owner).getState()).isEqualTo(StateEnum.OFFER);
    }

    /** A fresh, FK-valid user per test — the principal under test. */
    private UUID ownerId() {
        return users.createUser().getId();
    }

    private static ReadinessChoiceRequest request(ReadinessChoiceRequest.ChoiceEnum choice) {
        return ReadinessChoiceRequest.builder().choice(choice).build();
    }
}

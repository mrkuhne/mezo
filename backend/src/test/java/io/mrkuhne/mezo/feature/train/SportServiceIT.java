package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.LevelUpResult;
import io.mrkuhne.mezo.api.dto.SportScheduleSlotInput;
import io.mrkuhne.mezo.api.dto.SportScheduleSlotResponse;
import io.mrkuhne.mezo.api.dto.SportSessionCreateRequest;
import io.mrkuhne.mezo.api.dto.SportSessionResponse;
import io.mrkuhne.mezo.feature.train.entity.SportScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.service.SportService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service/repository-level tests for the T3 sport flows. Starts by pinning the new
 * sport_schedule_slot persistence shape (CHECKs, soft delete, owner+day ordering);
 * grows with SportService in Tasks 3–4.
 */
@Transactional
class SportServiceIT extends AbstractIntegrationTest {

    @Autowired private SportScheduleSlotRepository slotRepository;
    @Autowired private SportSessionRepository sportSessionRepository;
    @Autowired private SportService sportService;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private BiometricProfilePopulator biometricProfilePopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    /** JPA-managed shared EntityManager — the one allowed exception to constructor injection. */
    @PersistenceContext private EntityManager entityManager;

    @Test
    void testCreateScheduleSlot_shouldRoundTripAllFields_whenPersisted() {
        UUID user = databasePopulator.populateUser("sport@test.local");

        SportScheduleSlotEntity slot = trainPopulator.createScheduleSlot(user, 5, "10:00", 120, "match");
        entityManager.clear();

        SportScheduleSlotEntity reloaded = slotRepository.findById(slot.getId()).orElseThrow();
        assertThat(reloaded.getDayOfWeek()).isEqualTo(5);
        assertThat(reloaded.getTime()).isEqualTo("10:00");
        assertThat(reloaded.getDurationMin()).isEqualTo(120);
        assertThat(reloaded.getKind()).isEqualTo("match");
        assertThat(reloaded.getLocation()).isEqualTo("BVSC csarnok");
        assertThat(reloaded.getIntensityLabel()).isEqualTo("közepes");
        assertThat(reloaded.getCreatedBy()).isEqualTo(user);
    }

    @Test
    void testCreateScheduleSlot_shouldRejectRow_whenDayOfWeekOutOfRange() {
        UUID user = databasePopulator.populateUser("sport@test.local");
        assertThatThrownBy(() -> trainPopulator.createScheduleSlot(user, 7, "10:00", 90, "training"))
            .hasMessageContaining("ck_sport_schedule_slot_day_of_week");
    }

    @Test
    void testCreateScheduleSlot_shouldRejectRow_whenKindUnknown() {
        UUID user = databasePopulator.populateUser("sport@test.local");
        assertThatThrownBy(() -> trainPopulator.createScheduleSlot(user, 0, "18:15", 90, "race"))
            .hasMessageContaining("ck_sport_schedule_slot_kind");
    }

    @Test
    void testFinder_shouldScopeByOwnerAndHideSoftDeleted_whenQueried() {
        UUID a = databasePopulator.populateUser("sport-a@test.local");
        UUID b = databasePopulator.populateUser("sport-b@test.local");
        SportScheduleSlotEntity tue = trainPopulator.createScheduleSlot(a, 1, "17:00", 90, "training");
        SportScheduleSlotEntity mon = trainPopulator.createScheduleSlot(a, 0, "18:15", 90, "training");
        trainPopulator.createScheduleSlot(b, 0, "09:00", 60, "training");

        List<SportScheduleSlotEntity> slots =
            slotRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(a);
        assertThat(slots).extracting(SportScheduleSlotEntity::getId)
            .containsExactly(mon.getId(), tue.getId());

        slotRepository.delete(tue); // @SQLDelete flips is_deleted
        entityManager.flush();
        entityManager.clear();
        assertThat(slotRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(a))
            .extracting(SportScheduleSlotEntity::getId).containsExactly(mon.getId());
    }

    // ---- SportService.logSportSession (Task 3) ------------------------------------------------

    @Test
    void testLogSportSession_shouldDefaultDateAndTimeToNow_whenAbsent() {
        UUID user = databasePopulator.populateUser("sport@test.local");

        // the date default comes from the SERVER's clock: capture the day AROUND the call and accept
        // either side, so a midnight between the two reads cannot flip the assert
        LocalDate dayBefore = LocalDate.now();
        SportSessionResponse r = sportService.logSportSession(user, SportSessionCreateRequest.builder()
            .duration(90).setsPlayed(5).rpe(new BigDecimal("7")).shoulderStrain(6).build());
        LocalDate dayAfter = LocalDate.now();
        entityManager.flush();
        entityManager.clear();

        SportSessionEntity saved = sportSessionRepository.findById(r.getId()).orElseThrow();
        assertThat(saved.getDate()).isIn(dayBefore, dayAfter);
        assertThat(saved.getTime()).matches("\\d{2}:\\d{2}");
        assertThat(saved.getSport()).isEqualTo("volleyball");
        assertThat(saved.getDurationMin()).isEqualTo(90);
        assertThat(saved.getSetsPlayed()).isEqualTo(5);
        assertThat(saved.getRpe()).isEqualByComparingTo("7");
        assertThat(saved.getShoulderStrain()).isEqualTo(6);
        assertThat(saved.getIntensity()).isNull();   // not captured by the sheet
        assertThat(saved.getJumpCount()).isNull();   // not captured by the sheet
        assertThat(saved.getCreatedBy()).isEqualTo(user); // server-side ownership
    }

    @Test
    void testLogSportSession_shouldUseExplicitDateTimeAndNotes_whenProvided() {
        UUID user = databasePopulator.populateUser("sport@test.local");

        SportSessionResponse r = sportService.logSportSession(user, SportSessionCreateRequest.builder()
            .date(LocalDate.parse("2026-06-01")).time("19:30").notes("jó meccs")
            .duration(120).setsPlayed(6).rpe(new BigDecimal("8.5")).shoulderStrain(7).build());

        assertThat(r.getDate()).isEqualTo(LocalDate.parse("2026-06-01"));
        assertThat(r.getTime()).isEqualTo("19:30");
        assertThat(r.getNotes()).isEqualTo("jó meccs");
        assertThat(r.getDuration()).isEqualTo(120);
        assertThat(r.getIntensity()).isNull();
    }

    @Test
    void testLogSportSession_shouldReturnVolleyballLevelUp_whenProgressionEnabled() {
        UUID owner = databasePopulator.populateUser("sportlvl@test.local");

        SportSessionResponse res = sportService.logSportSession(owner, SportSessionCreateRequest.builder()
            .duration(90).setsPlayed(5).rpe(new BigDecimal("7")).shoulderStrain(6).build());

        assertThat(res.getSport()).isEqualTo("volleyball");
        assertThat(res.getLevelUp()).isNotNull();
        assertThat(res.getLevelUp().getSource()).isEqualTo(LevelUpResult.SourceEnum.SPORT);
    }

    @Test
    void testLogSportSession_shouldPersistCrossKindAndRounds_whenCrossSession() {
        UUID owner = databasePopulator.populateUser("sportcross@test.local");

        SportSessionResponse res = sportService.logSportSession(owner, SportSessionCreateRequest.builder()
            .sport("cross").duration(45).rounds(8).rpe(new BigDecimal("8")).build());

        assertThat(res.getSport()).isEqualTo("cross");
        assertThat(res.getRounds()).isEqualTo(8);
        assertThat(res.getSetsPlayed()).isNull();
        assertThat(res.getLevelUp()).isNotNull();
    }

    // ---- kcal: the personalised MET estimate + the user's override (mezo-88iwa.9) -------------

    /** The prototype-default profile (M, born 1991-03-01, 15% body fat) plus one weigh-in. */
    private void seedBody(UUID owner, String weightKg) {
        biometricProfilePopulator.create(owner);
        weightLogPopulator.createWeightLog(owner, LocalDate.parse("2026-05-30"), new BigDecimal(weightKg));
    }

    /** BMR (Katch-McArdle) for the fixture profile (M, 15% body fat) at {@code weightKg} —
     *  mirrors {@code TdeeBootstrapService#bmr}. */
    private static BigDecimal bmrFor(String weightKg) {
        BigDecimal leanFraction = BigDecimal.ONE.subtract(
            new BigDecimal("15.0").divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP));
        return new BigDecimal("370")
            .add(new BigDecimal("21.6").multiply(new BigDecimal(weightKg).multiply(leanFraction)));
    }

    /** The net activity-energy model's own arithmetic (mezo-32m82): mirrors
     *  {@code ActivityEnergyModel#netKcal} — {@code (met − 1) × bmr/24 × minutes/60}, HALF_UP. */
    private static int netKcal(BigDecimal bmrKcal, double met, int minutes) {
        BigDecimal rest = bmrKcal.divide(BigDecimal.valueOf(24), MathContext.DECIMAL64);
        BigDecimal kcal = BigDecimal.valueOf(met - 1).multiply(rest)
            .multiply(BigDecimal.valueOf(minutes)).divide(BigDecimal.valueOf(60), MathContext.DECIMAL64);
        return kcal.setScale(0, RoundingMode.HALF_UP).intValueExact();
    }

    @Test
    void testLogSportSession_shouldPersistTheEstimateFlagged_whenBodyKnown() {
        UUID owner = databasePopulator.populateUser("sportkcal@test.local");
        seedBody(owner, "80.00");

        SportSessionResponse res = sportService.logSportSession(owner, SportSessionCreateRequest.builder()
            .sport("volleyball").date(LocalDate.parse("2026-06-01")).time("18:00")
            .duration(90).setsPlayed(4).rpe(new BigDecimal("7")).build());
        entityManager.flush();
        entityManager.clear();

        // rpe 7 -> moderate band -> volleyball MET 4.0; net = (4.0 − 1) × bmr/24 × 90/60
        int expected = netKcal(bmrFor("80.00"), 4.0, 90);
        assertThat(res.getKcal()).isEqualTo(expected);
        assertThat(res.getKcalIsEstimate()).isTrue();
        SportSessionEntity saved = sportSessionRepository.findById(res.getId()).orElseThrow();
        assertThat(saved.getKcal()).isEqualTo(expected);
        assertThat(saved.getKcalIsEstimate()).isTrue();
    }

    @Test
    void testLogSportSession_shouldStoreTheOverrideVerbatim_whenUserGaveOne() {
        UUID owner = databasePopulator.populateUser("sportoverride@test.local");
        seedBody(owner, "80.00");

        SportSessionResponse res = sportService.logSportSession(owner, SportSessionCreateRequest.builder()
            .sport("volleyball").date(LocalDate.parse("2026-06-01"))
            .duration(90).rpe(new BigDecimal("7")).kcalOverride(540).build());
        entityManager.flush();
        entityManager.clear();

        assertThat(res.getKcal()).isEqualTo(540);
        assertThat(res.getKcalIsEstimate()).isFalse();
        SportSessionEntity saved = sportSessionRepository.findById(res.getId()).orElseThrow();
        assertThat(saved.getKcal()).isEqualTo(540);
        assertThat(saved.getKcalIsEstimate()).isFalse();
    }

    @Test
    void testLogSportSession_shouldLeaveKcalNull_whenNoWeighInYet() {
        UUID owner = databasePopulator.populateUser("sportnoweight@test.local");
        biometricProfilePopulator.create(owner); // profile but no weigh-in

        SportSessionResponse res = sportService.logSportSession(owner, SportSessionCreateRequest.builder()
            .sport("cross").duration(45).rounds(6).rpe(new BigDecimal("8")).build());
        entityManager.flush();
        entityManager.clear();

        assertThat(res.getKcal()).isNull(); // never 0 — a missing estimate stays missing
        assertThat(res.getKcalIsEstimate()).isNull();
        assertThat(sportSessionRepository.findById(res.getId()).orElseThrow().getKcal()).isNull();
    }

    @Test
    void testLogSportSession_shouldLeaveKcalNull_whenNoBiometricProfile() {
        UUID owner = databasePopulator.populateUser("sportnoprofile@test.local");
        weightLogPopulator.createWeightLog(owner, LocalDate.parse("2026-05-30"), new BigDecimal("80.00"));

        SportSessionResponse res = sportService.logSportSession(owner, SportSessionCreateRequest.builder()
            .duration(90).rpe(new BigDecimal("7")).build());

        assertThat(res.getKcal()).isNull();
        assertThat(res.getKcalIsEstimate()).isNull();
    }

    @Test
    void testLogSportSession_shouldAcceptTheWidenedVocabulary_whenNewSportId() {
        UUID owner = databasePopulator.populateUser("sportbike@test.local");
        seedBody(owner, "80.00");

        SportSessionResponse res = sportService.logSportSession(owner, SportSessionCreateRequest.builder()
            .sport("bike").date(LocalDate.parse("2026-06-01")).duration(60)
            .rpe(new BigDecimal("6")).build());
        entityManager.flush(); // the widened ck_sport_session_sport must accept the row
        entityManager.clear();

        SportSessionEntity saved = sportSessionRepository.findById(res.getId()).orElseThrow();
        assertThat(saved.getSport()).isEqualTo("bike");
        assertThat(res.getSport()).isEqualTo("bike");
        // rpe 6 -> moderate band -> bike MET 6.8; net = (6.8 − 1) × bmr/24 × 60/60
        assertThat(res.getKcal()).isEqualTo(netKcal(bmrFor("80.00"), 6.8, 60));
        assertThat(res.getKcalIsEstimate()).isTrue();
    }

    @Test
    void testLogSportSession_shouldFoldRpeIntoTheBand_whenIntensityDiffers() {
        // Regression for a masked bug: applyKcal used to read the never-populated entity
        // `intensity` column instead of the wire's `rpe`. Two otherwise-identical volleyball logs
        // at opposite ends of the rpe scale must fold to different bands (mezo-32m82: rpe 1-4
        // light, 8-10 hard) and so persist different kcal.
        UUID owner = databasePopulator.populateUser("sportrpe@test.local");
        seedBody(owner, "80.00");

        SportSessionResponse low = sportService.logSportSession(owner, SportSessionCreateRequest.builder()
            .sport("volleyball").date(LocalDate.parse("2026-06-01")).time("18:00")
            .duration(90).rpe(new BigDecimal("3")).build());
        SportSessionResponse high = sportService.logSportSession(owner, SportSessionCreateRequest.builder()
            .sport("volleyball").date(LocalDate.parse("2026-06-01")).time("19:30")
            .duration(90).rpe(new BigDecimal("10")).build());
        entityManager.flush();
        entityManager.clear();

        BigDecimal bmr = bmrFor("80.00");
        // rpe 3 -> light band -> volleyball MET 3.0; net = (3.0 − 1) × bmr/24 × 90/60
        int expectedLow = netKcal(bmr, 3.0, 90);
        // rpe 10 -> hard band -> volleyball MET 6.0; net = (6.0 − 1) × bmr/24 × 90/60
        int expectedHigh = netKcal(bmr, 6.0, 90);
        assertThat(low.getKcal()).isEqualTo(expectedLow);
        assertThat(high.getKcal()).isEqualTo(expectedHigh);
        assertThat(low.getKcal()).isNotEqualTo(high.getKcal());

        SportSessionEntity savedLow = sportSessionRepository.findById(low.getId()).orElseThrow();
        SportSessionEntity savedHigh = sportSessionRepository.findById(high.getId()).orElseThrow();
        assertThat(savedLow.getKcal()).isEqualTo(expectedLow);
        assertThat(savedHigh.getKcal()).isEqualTo(expectedHigh);
    }

    @Test
    void testLogSportSession_shouldRejectTheRow_whenSportOutsideTheVocabulary() {
        UUID owner = databasePopulator.populateUser("sportbad@test.local");
        assertThatThrownBy(() -> {
            sportService.logSportSession(owner, SportSessionCreateRequest.builder()
                .sport("kajak").duration(60).rpe(new BigDecimal("6")).build());
            entityManager.flush();
        }).hasMessageContaining("ck_sport_session_sport");
    }

    // ---- SportService schedule get/replace (Task 4) -------------------------------------------

    @Test
    void testGetSchedule_shouldReturnEmptyList_whenNoneSet() {
        UUID user = databasePopulator.populateUser("sport@test.local");
        assertThat(sportService.getSchedule(user)).isEmpty();
    }

    @Test
    void testReplaceSchedule_shouldCreateSlotsInWeekOrder_whenSavedFirstTime() {
        UUID user = databasePopulator.populateUser("sport@test.local");

        List<SportScheduleSlotResponse> saved = sportService.replaceSchedule(user, List.of(
            SportScheduleSlotInput.builder().dayOfWeek(5).time("10:00").durationMin(120)
                .kind("match").location("Kőbánya Sport").intensityLabel("magas").build(),
            SportScheduleSlotInput.builder().dayOfWeek(0).time("18:15").durationMin(90)
                .kind("training").location("BVSC csarnok").build()));

        assertThat(saved).extracting(SportScheduleSlotResponse::getDayOfWeek).containsExactly(0, 5);
        assertThat(saved.get(0).getKind()).isEqualTo(SportScheduleSlotResponse.KindEnum.TRAINING);
        assertThat(saved.get(1).getLocation()).isEqualTo("Kőbánya Sport");
        assertThat(saved.get(0).getIntensityLabel()).isNull();
    }

    @Test
    void testReplaceSchedule_shouldSoftDeletePreviousSlots_whenSavedAgain() {
        UUID user = databasePopulator.populateUser("sport@test.local");
        trainPopulator.createScheduleSlot(user, 0, "18:15", 90, "training");
        trainPopulator.createScheduleSlot(user, 1, "17:00", 90, "training");

        sportService.replaceSchedule(user, List.of(
            SportScheduleSlotInput.builder().dayOfWeek(3).time("19:00").durationMin(60).kind("training").build()));
        entityManager.flush();
        entityManager.clear();

        List<SportScheduleSlotResponse> after = sportService.getSchedule(user);
        assertThat(after).hasSize(1);
        assertThat(after.get(0).getDayOfWeek()).isEqualTo(3);
    }

    @Test
    void testReplaceSchedule_shouldNotTouchOtherUsersSlots_whenSaved() {
        UUID a = databasePopulator.populateUser("sport-a@test.local");
        UUID b = databasePopulator.populateUser("sport-b@test.local");
        trainPopulator.createScheduleSlot(b, 0, "09:00", 60, "training");

        sportService.replaceSchedule(a, List.of());

        assertThat(sportService.getSchedule(b)).hasSize(1);
    }
}

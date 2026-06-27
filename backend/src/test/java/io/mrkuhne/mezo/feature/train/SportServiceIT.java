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
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
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

        SportSessionResponse r = sportService.logSportSession(user, SportSessionCreateRequest.builder()
            .duration(90).setsPlayed(5).rpe(new BigDecimal("7")).shoulderStrain(6).build());
        entityManager.flush();
        entityManager.clear();

        SportSessionEntity saved = sportSessionRepository.findById(r.getId()).orElseThrow();
        assertThat(saved.getDate()).isEqualTo(LocalDate.now());
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

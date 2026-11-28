package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PlannedSkipKind;
import io.mrkuhne.mezo.api.dto.PlannedSkipReason;
import io.mrkuhne.mezo.api.dto.PlannedSkipRequest;
import io.mrkuhne.mezo.api.dto.PlannedSkipResponse;
import io.mrkuhne.mezo.api.dto.SportBodyResponse;
import io.mrkuhne.mezo.api.dto.SportGapsResponse;
import io.mrkuhne.mezo.api.dto.SportHint;
import io.mrkuhne.mezo.api.dto.SportItemState;
import io.mrkuhne.mezo.api.dto.SportLaneItem;
import io.mrkuhne.mezo.api.dto.SportLoadResponse;
import io.mrkuhne.mezo.api.dto.SportLoadWeek;
import io.mrkuhne.mezo.api.dto.SportMuscleHeat;
import io.mrkuhne.mezo.api.dto.SportOverviewResponse;
import io.mrkuhne.mezo.api.dto.SportShoulderResponse;
import io.mrkuhne.mezo.api.dto.SportTonight;
import io.mrkuhne.mezo.api.dto.SportWeekDay;
import io.mrkuhne.mezo.feature.train.config.TrainOwnerZoneProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WearableWorkoutPopulator;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** Boop Sport S2 (mezo-r36n9.202): the Sport area's five read models through the generated contract. */
class SportReadContractIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator train;
    @Autowired private WearableWorkoutPopulator wearable;
    @Autowired private SportSessionRepository sportSessions;
    @Autowired private TrainOwnerZoneProperties zone;

    private ZoneId zone() {
        return zone.zoneId();
    }

    private LocalDate today() {
        return LocalDate.now(zone());
    }

    private static int dow(LocalDate d) {
        return d.getDayOfWeek().getValue() - 1;
    }

    // ---- 401 ----------------------------------------------------------------------------------

    @Test
    void testEverySportRead_shouldReturn401_whenUnauthenticated() {
        for (String path : new String[] {"overview", "load", "body", "shoulder", "gaps"}) {
            getForBody("/api/train/sport/" + path, null, HttpStatus.UNAUTHORIZED, Void.class);
        }
    }

    @Test
    void testGetSportLoad_shouldReturn400_whenWeeksOutOfRange() {
        getForBody("/api/train/sport/load?weeks=0", ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        getForBody("/api/train/sport/shoulder?weeks=27", ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
    }

    // ---- empty user ---------------------------------------------------------------------------

    @Test
    void testEverySportRead_shouldReturnEmptyShapes_whenUserHasNoTraining() {
        RegisteredUser user = registerUser("Sport Empty");
        LocalDate monday = today().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

        SportOverviewResponse o = getForBody("/api/train/sport/overview", user.headers(), HttpStatus.OK,
            SportOverviewResponse.class);
        assertThat(o.getWeekStart()).isEqualTo(monday);
        assertThat(o.getWeekEnd()).isEqualTo(monday.plusDays(6));
        assertThat(o.getToday()).isEqualTo(today());
        assertThat(o.getDays()).hasSize(7).allSatisfy(d -> {
            assertThat(d.getGym()).isEmpty();
            assertThat(d.getSport()).isEmpty();
        });
        assertThat(o.getWeekCount()).isNull();
        assertThat(o.getTonight()).isNull();
        assertThat(o.getHints()).isEmpty();
        assertThat(o.getTotals().getMovementMinutes()).isZero();

        SportLoadResponse load = getForBody("/api/train/sport/load", user.headers(), HttpStatus.OK,
            SportLoadResponse.class);
        assertThat(load.getWeeks()).hasSize(6).allSatisfy(w -> {
            assertThat(w.getSportLoad()).isZero();
            assertThat(w.getGymLoad()).isZero();
        });
        assertThat(load.getWeeks().get(5).getWeekStart()).isEqualTo(monday);

        SportBodyResponse body = getForBody("/api/train/sport/body", user.headers(), HttpStatus.OK,
            SportBodyResponse.class);
        assertThat(body.getMuscles()).isEmpty();
        assertThat(body.getShoulderAverage()).isNull();
        assertThat(body.getSharedMuscles()).isZero();

        SportShoulderResponse shoulder = getForBody("/api/train/sport/shoulder?weeks=3", user.headers(),
            HttpStatus.OK, SportShoulderResponse.class);
        assertThat(shoulder.getWeeks()).hasSize(3).allSatisfy(w -> assertThat(w.getAverage()).isNull());

        SportGapsResponse gaps = getForBody("/api/train/sport/gaps", user.headers(), HttpStatus.OK,
            SportGapsResponse.class);
        assertThat(gaps.getDays()).hasSize(7).allSatisfy(d -> {
            assertThat(d.getBlocks()).isEmpty();
            assertThat(d.getGapHours()).isNull();
        });
        assertThat(gaps.getHints()).isEmpty();
    }

    // ---- tonight: the Watch pre-fill ----------------------------------------------------------

    @Test
    void testGetSportOverview_shouldOfferThePreFill_whenTodaysVolleyballWorkoutIsNotLogged() {
        RegisteredUser user = registerUser("Sport Prefill");
        LocalDate today = today();
        train.createScheduleSlot(user.id(), dow(today), "18:00", 90, "match");
        var start = today.atTime(18, 5).atZone(zone()).toInstant();
        var w = wearable.createWorkout(user.id(), "hk-vb-1", today, "volleyball", start, start.plusSeconds(85 * 60));

        SportTonight t = overview(user).getTonight();
        assertThat(t.getMoment()).isEqualTo(SportTonight.MomentEnum.RECORDED);
        assertThat(t.getSport()).isEqualTo("volleyball");
        assertThat(t.getTime()).isEqualTo("18:00");
        assertThat(t.getKind()).isEqualTo(SportTonight.KindEnum.MATCH);
        assertThat(t.getHealth().getMinutes()).isEqualTo(85);
        assertThat(t.getSession()).isNull();
        assertThat(w.getId()).isNotNull();
    }

    @Test
    void testGetSportOverview_shouldMoveToDone_whenTheWorkoutIsMatchedByALog() {
        RegisteredUser user = registerUser("Sport Prefill Done");
        LocalDate today = today();
        train.createScheduleSlot(user.id(), dow(today), "18:00", 90, "training");
        var start = today.atTime(18, 0).atZone(zone()).toInstant();
        wearable.createWorkout(user.id(), "hk-vb-2", today, "volleyball", start, start.plusSeconds(90 * 60));
        SportSessionEntity log = train.createSportSessionAt(user.id(), today, "18:00", 90);
        log.setRpe(new BigDecimal("7"));
        log.setShoulderStrain(6);
        sportSessions.saveAndFlush(log);

        SportOverviewResponse o = overview(user);
        SportTonight t = o.getTonight();
        assertThat(t.getMoment()).isEqualTo(SportTonight.MomentEnum.DONE);
        assertThat(t.getSession().getId()).isEqualTo(log.getId());
        assertThat(t.getSession().getLoad()).isEqualTo(630);
        assertThat(t.getHealth().getMinutes()).isEqualTo(90);
        assertThat(o.getWeekCount().getDone()).isEqualTo(1);
        assertThat(o.getWeekCount().getPlanned()).isEqualTo(1);
        assertThat(day(o, today).getSport()).singleElement().satisfies(i -> {
            assertThat(i.getState()).isEqualTo(SportItemState.DONE);
            assertThat(i.getLoad()).isEqualTo(630);
        });
    }

    @Test
    void testGetSportOverview_shouldNotPreFill_whenOnlyAStrengthWorkoutExists() {
        RegisteredUser user = registerUser("Sport No Prefill");
        LocalDate today = today();
        train.createScheduleSlot(user.id(), dow(today), "18:00", 90, "training");
        var start = today.atTime(18, 0).atZone(zone()).toInstant();
        wearable.createWorkout(user.id(), "hk-str-1", today, "strength", start, start.plusSeconds(60 * 60));

        SportTonight t = overview(user).getTonight();
        assertThat(t.getMoment()).isEqualTo(SportTonight.MomentEnum.BEFORE);
        assertThat(t.getHealth()).isNull();
        assertThat(t.getStartsInMinutes()).isNotNull();
    }

    @Test
    void testGetSportOverview_shouldShowTheSkipWithItsReason_whenTonightIsSkipped() {
        RegisteredUser user = registerUser("Sport Skipped");
        LocalDate today = today();
        train.createScheduleSlot(user.id(), dow(today), "18:00", 90, "training");
        PlannedSkipResponse skip = putForBody("/api/train/skips", PlannedSkipRequest.builder()
                .date(today).kind(PlannedSkipKind.SPORT).dayOfWeek(dow(today)).time("18:00")
                .reasonCategory(PlannedSkipReason.TIRED).build(),
            user.headers(), HttpStatus.OK, PlannedSkipResponse.class);

        SportOverviewResponse o = overview(user);
        SportTonight t = o.getTonight();
        assertThat(t.getMoment()).isEqualTo(SportTonight.MomentEnum.SKIPPED);
        assertThat(t.getSkip().getId()).isEqualTo(skip.getId());
        assertThat(t.getSkip().getReason()).isEqualTo(PlannedSkipReason.TIRED);
        assertThat(t.getSkip().getFreePass()).isTrue();
        assertThat(day(o, today).getSport()).singleElement().satisfies(i -> {
            assertThat(i.getState()).isEqualTo(SportItemState.SKIPPED);
            assertThat(i.getSkipId()).isEqualTo(skip.getId());
            assertThat(i.getSport()).isEqualTo("volleyball");
        });
    }

    // ---- a fixture week: lanes, load, body, shoulder, gaps ---------------------------------------

    @Test
    void testSportReads_shouldAgreeOnAFixtureWeek_whenGymAndVolleyballShareADay() {
        RegisteredUser user = registerUser("Sport Fixture");
        LocalDate day = today().minusWeeks(2).with(TemporalAdjusters.previousOrSame(DayOfWeek.TUESDAY));
        train.createGymSlot(user.id(), dow(day), "08:00");
        train.createScheduleSlot(user.id(), dow(day), "10:00", 90, "training");
        // gym: 60 min, 3 quad sets at RIR 2 → RPE 8 → load 480
        WorkoutSessionEntity template = train.createCustomTemplateDay(user.id(), "Láb");
        ExerciseEntity squat = train.createExercise(user.id(), template.getId(), "Guggolás", "quad", "compound");
        WorkoutSessionEntity done = train.createWorkoutInstance(user.id(), template, day, "completed");
        done.setActiveSeconds(3600);
        train.save(done);
        for (int i = 0; i < 3; i++) {
            train.createLoggedSet(user.id(), squat.getId(), done.getId(), i, "100", 8, 2);
        }
        // sport: volleyball 10:00, 90 min, RPE 7 → load 630, shoulder 6
        SportSessionEntity vb = train.createSportSessionAt(user.id(), day, "10:00", 90);
        vb.setRpe(new BigDecimal("7"));
        vb.setShoulderStrain(6);
        sportSessions.saveAndFlush(vb);
        String week = "?week=" + day;
        LocalDate monday = day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

        SportOverviewResponse o = getForBody("/api/train/sport/overview" + week, user.headers(), HttpStatus.OK,
            SportOverviewResponse.class);
        assertThat(o.getWeekStart()).isEqualTo(monday);
        assertThat(o.getTonight()).isNull(); // not this week
        SportWeekDay d = day(o, day);
        assertThat(d.getGym()).singleElement().satisfies(i -> {
            assertThat(i.getState()).isEqualTo(SportItemState.DONE);
            assertThat(i.getTime()).isEqualTo("08:00");
            assertThat(i.getLoad()).isEqualTo(480);
        });
        assertThat(d.getSport()).extracting(SportLaneItem::getState).containsExactly(SportItemState.DONE);
        assertThat(o.getTotals().getGymMinutes()).isEqualTo(60);
        assertThat(o.getTotals().getSportMinutes()).isEqualTo(90);
        assertThat(o.getTotals().getMovementMinutes()).isEqualTo(150);
        assertThat(o.getHints()).extracting(SportHint::getKey).contains(SportHint.KeyEnum.GAP_TIGHT);

        SportLoadResponse load = getForBody("/api/train/sport/load", user.headers(), HttpStatus.OK,
            SportLoadResponse.class);
        SportLoadWeek lw = load.getWeeks().stream().filter(w -> w.getWeekStart().equals(monday)).findFirst()
            .orElseThrow();
        assertThat(lw.getGymLoad()).isEqualTo(480);
        assertThat(lw.getSportLoad()).isEqualTo(630);

        SportBodyResponse body = getForBody("/api/train/sport/body" + week, user.headers(), HttpStatus.OK,
            SportBodyResponse.class);
        // quad: gym 480, sport 0.9 × 630 = 567 → the hottest together
        assertThat(body.getMuscles().get(0)).satisfies(m -> {
            assertThat(m.getMuscle()).isEqualTo("quad");
            assertThat(m.getGymLoad()).isEqualTo(480);
            assertThat(m.getSportLoad()).isEqualTo(567);
            assertThat(m.getTogether()).isEqualByComparingTo("1.0");
        });
        assertThat(body.getMuscles()).extracting(SportMuscleHeat::getMuscle).contains("shoulder-side", "calf");
        assertThat(body.getSharedMuscles()).isEqualTo(1);
        assertThat(body.getShoulderAverage()).isEqualByComparingTo("6.0");

        SportShoulderResponse shoulder = getForBody("/api/train/sport/shoulder", user.headers(), HttpStatus.OK,
            SportShoulderResponse.class);
        assertThat(shoulder.getWeeks()).filteredOn(w -> w.getWeekStart().equals(monday)).singleElement()
            .satisfies(w -> assertThat(w.getAverage()).isEqualByComparingTo("6.0"));

        SportGapsResponse gaps = getForBody("/api/train/sport/gaps" + week, user.headers(), HttpStatus.OK,
            SportGapsResponse.class);
        assertThat(gaps.getDays()).filteredOn(g -> g.getDate().equals(day)).singleElement().satisfies(g -> {
            assertThat(g.getBlocks()).hasSize(2);
            assertThat(g.getGapHours()).isEqualByComparingTo("1.0"); // gym 08:00–09:00, sport 10:00
        });
        assertThat(gaps.getHints()).filteredOn(h -> h.getKey() == SportHint.KeyEnum.GAP_TIGHT).singleElement()
            .satisfies(h -> {
                assertThat(h.getDate()).isEqualTo(day);
                assertThat(h.getSeverity()).isEqualTo(SportHint.SeverityEnum.WATCH);
            });
    }

    private SportOverviewResponse overview(RegisteredUser user) {
        return getForBody("/api/train/sport/overview", user.headers(), HttpStatus.OK, SportOverviewResponse.class);
    }

    private static SportWeekDay day(SportOverviewResponse o, LocalDate date) {
        return o.getDays().stream().filter(d -> d.getDate().equals(date)).findFirst().orElseThrow();
    }
}

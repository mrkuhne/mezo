package io.mrkuhne.mezo.feature.season;

import io.mrkuhne.mezo.feature.season.entity.SeasonDraftJson;
import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.port.SeasonGoalPort;
import io.mrkuhne.mezo.feature.season.repository.SeasonRepository;
import io.mrkuhne.mezo.feature.season.service.SeasonDraftMath;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Season IT fixture (mezo-r36n9.16): an owner with a body profile, a weigh-in (84.0 kg, invented), a sleep goal
 * (7 h 30, wake 06:30), four gym days (hétfő, kedd, csütörtök, péntek 17:30) and two 90-minute volleyball evenings
 * (kedd, csütörtök) — and, on demand, a planned season whose draft is exactly that state.
 */
@TestComponent
@RequiredArgsConstructor
public class SeasonFixture {

    public static final List<Integer> GYM = List.of(0, 1, 3, 4);
    public static final List<SeasonDraftJson.SportSlot> SPORT = List.of(
        new SeasonDraftJson.SportSlot(1, "19:00", 90, "volleyball"),
        new SeasonDraftJson.SportSlot(3, "19:00", 90, "volleyball"));

    private final DatabasePopulator databasePopulator;
    private final BiometricProfilePopulator profilePopulator;
    private final WeightLogPopulator weightLogPopulator;
    private final SleepGoalPopulator sleepGoalPopulator;
    private final TrainPopulator trainPopulator;
    private final SeasonGoalPort goalPort;
    private final SeasonRepository seasonRepository;

    public UUID owner(String email) {
        UUID owner = databasePopulator.populateUser(email);
        profilePopulator.create(owner);
        weightLogPopulator.createWeightLog(owner, LocalDate.now().minusDays(1), new BigDecimal("84.0"));
        sleepGoalPopulator.goal(owner, 450, "WAKE", "06:30", 15);
        GYM.forEach(d -> trainPopulator.createGymSlot(owner, d, "17:30"));
        SPORT.forEach(s -> trainPopulator.createScheduleSlot(owner, s.dayOfWeek(), s.time(), s.durationMin(), "training"));
        return owner;
    }

    /** A cut to 80.0 kg over 12 weeks from today, on the fixture's slots. */
    public static SeasonDraftJson draft() {
        return draft("cut", new BigDecimal("80.0"), null, GYM, SPORT);
    }

    public static SeasonDraftJson draft(String trajectory, BigDecimal target, BigDecimal ratePct,
                                        List<Integer> gym, List<SeasonDraftJson.SportSlot> sport) {
        return new SeasonDraftJson("Őszi évad", trajectory, target, ratePct, null, LocalDate.now(), 12, gym, "17:30",
            sport, new SeasonDraftJson.SleepAnchor("WAKE", "06:30"), List.of(), null);
    }

    /** A planned season (and its planned goal) whose draft is {@code d}. */
    public SeasonEntity plannedSeason(UUID owner, SeasonDraftJson d) {
        UUID goalId = goalPort.createGoal(owner,
            SeasonDraftMath.goalFields(d, new BigDecimal("84.0"), List.of("strength", "muscle")));
        SeasonEntity s = new SeasonEntity();
        s.setCreatedBy(owner);
        s.setTitle(d.title());
        s.setStatus(SeasonEntity.STATUS_PLANNED);
        s.setStartDate(d.startDate());
        s.setWeeks(d.weeks());
        s.setGoalId(goalId);
        s.setDraft(d);
        return seasonRepository.saveAndFlush(s);
    }
}

package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.port.SeasonMealPort;
import io.mrkuhne.mezo.feature.season.port.SeasonMetricsPort;
import io.mrkuhne.mezo.feature.season.port.SeasonSleepPort;
import io.mrkuhne.mezo.feature.season.port.SeasonTrainPort;
import io.mrkuhne.mezo.feature.season.repository.SeasonRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The single source of day judgement (spec §5.6, contract {@code getAdherence}) — served whether or not a season
 * exists. Per day:
 *
 * <ul>
 *   <li><b>judged</b> (the food side counts) = not today or later, not a kímélő day, something logged — exactly the
 *       Étel Hét tab's rule ({@code EtelHet.hetWeek}: {@code !isToday && fuelMode == nil && consumed.kcal > 0}),
 *       read from the same fuel week ({@link SeasonMealPort});</li>
 *   <li><b>foodInBand</b> = judged and |kcal − target| ≤ 10 % of the day's served target;</li>
 *   <li><b>sessionPlanned</b> = a weekly gym / sport slot on that weekday or a planned run; <b>sessionDone</b> = a
 *       completed workout, sport session or run that date (null when nothing was planned, excused, or today+);</li>
 *   <li><b>sleepOk</b> = the night ending that morning ≥ the need − 15 min; the need is the active season's, else
 *       his own sleep goal (null when neither exists — never a default);</li>
 *   <li><b>excused</b> = a kímélő day ({@code kimelo}) or a reasoned gym / sport / run skip ({@code skip}).
 *       Excused days leave every count of the summary.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class AdherenceService {

    static final int MAX_DAYS = 62;
    static final int SLEEP_GRACE_MIN = 15;
    static final int WEEK_DAYS = 7;

    private final SeasonMealPort mealPort;
    private final SeasonTrainPort trainPort;
    private final SeasonMetricsPort metricsPort;
    private final SeasonSleepPort sleepPort;
    private final SeasonRepository seasonRepository;

    public record AdherenceDay(LocalDate date, boolean judged, boolean excused, String excuse, Integer kcal,
                               Integer targetKcal, Integer proteinG, Integer targetProteinG, Boolean foodInBand,
                               boolean sessionPlanned, Boolean sessionDone, Integer sleepMin, Integer needMin,
                               Boolean sleepOk) {
    }

    public record Summary(int foodInBand, int foodJudged, int sessionsDone, int sessionsPlanned, int nightsOk,
                          int nightsJudged, int excusedDays) {

        /** True when nothing at all could be judged (and nothing was excused). */
        boolean empty() {
            return foodJudged == 0 && sessionsPlanned == 0 && nightsJudged == 0 && excusedDays == 0;
        }
    }

    public record Result(List<AdherenceDay> days, Summary summary) {
    }

    /** {@code from..to} inclusive, at most {@value #MAX_DAYS} days, {@code to ≥ from}; else 400. */
    @Transactional(readOnly = true)
    public Result range(UUID owner, LocalDate from, LocalDate to) {
        if (from == null || to == null || to.isBefore(from) || ChronoUnit.DAYS.between(from, to) + 1 > MAX_DAYS) {
            throw new SystemRuntimeErrorException(SystemMessage.field("VALIDATION_INVALID_VALUE", "to").build(),
                HttpStatus.BAD_REQUEST);
        }
        List<AdherenceDay> days = days(owner, from, to, LocalDate.now());
        return new Result(days, summarize(days));
    }

    /** The last seven days ending yesterday; empty when nothing at all could be judged. */
    @Transactional(readOnly = true)
    public Optional<Summary> lastWeek(UUID owner, LocalDate today) {
        Summary s = summarize(days(owner, today.minusDays(WEEK_DAYS), today.minusDays(1), today));
        return s.empty() ? Optional.empty() : Optional.of(s);
    }

    /** The days of {@code from..to} judged as of {@code today}, unvalidated (callers in this package bound it). */
    List<AdherenceDay> days(UUID owner, LocalDate from, LocalDate to, LocalDate today) {
        List<SeasonMealPort.FoodDay> food = mealPort.foodDays(owner, from, to);
        Set<LocalDate> planned = trainPort.plannedSessionDays(owner, from, to);
        Set<LocalDate> done = trainPort.doneSessionDays(owner, from, to);
        Set<LocalDate> skipped = trainPort.excusedSessionDays(owner, from, to);
        Map<LocalDate, Integer> sleep = metricsPort.sleepMinutes(owner, from, to);
        Integer need = need(owner);

        List<AdherenceDay> out = new ArrayList<>(food.size());
        for (SeasonMealPort.FoodDay f : food) {
            LocalDate d = f.date();
            boolean past = d.isBefore(today);
            boolean skip = skipped.contains(d);
            boolean excused = f.kimelo() || skip;
            String excuse = f.kimelo() ? "kimelo" : skip ? "skip" : null;
            boolean judged = past && !f.kimelo() && f.kcal() != null;
            Boolean inBand = judged ? Math.abs(f.kcal() - f.targetKcal()) * 10 <= f.targetKcal() : null;
            boolean sessionPlanned = planned.contains(d) || skip;
            Boolean sessionDone = !sessionPlanned || excused || !past ? null : done.contains(d);
            Integer sleepMin = sleep.get(d);
            Boolean sleepOk = sleepMin == null || need == null ? null : sleepMin >= need - SLEEP_GRACE_MIN;
            out.add(new AdherenceDay(d, judged, excused, excuse, f.kcal(), f.targetKcal(), f.proteinG(),
                f.targetProteinG(), inBand, sessionPlanned, sessionDone, sleepMin, need, sleepOk));
        }
        return out;
    }

    /** The active season's sleep need, else his own sleep goal; null when he has neither. */
    private Integer need(UUID owner) {
        Optional<Integer> season = seasonRepository.findActive(owner).map(SeasonEntity::getSleepNeedMin);
        if (season.isPresent()) {
            return season.get();
        }
        SeasonSleepPort.SleepGoal goal = sleepPort.get(owner);
        return goal.isSet() ? goal.targetMinutes() : null;
    }

    static Summary summarize(List<AdherenceDay> days) {
        int inBand = 0;
        int judged = 0;
        int sessionsDone = 0;
        int sessionsPlanned = 0;
        int nightsOk = 0;
        int nightsJudged = 0;
        int excused = 0;
        for (AdherenceDay d : days) {
            if (d.excused()) {
                excused++;
                continue;
            }
            judged += d.judged() ? 1 : 0;
            inBand += Boolean.TRUE.equals(d.foodInBand()) ? 1 : 0;
            sessionsPlanned += d.sessionDone() != null ? 1 : 0;
            sessionsDone += Boolean.TRUE.equals(d.sessionDone()) ? 1 : 0;
            nightsJudged += d.sleepOk() != null ? 1 : 0;
            nightsOk += Boolean.TRUE.equals(d.sleepOk()) ? 1 : 0;
        }
        return new Summary(inBand, judged, sessionsDone, sessionsPlanned, nightsOk, nightsJudged, excused);
    }
}

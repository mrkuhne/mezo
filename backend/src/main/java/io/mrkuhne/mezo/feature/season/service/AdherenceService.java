package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.port.SeasonAdjustmentPort;
import io.mrkuhne.mezo.feature.season.port.SeasonMealPort;
import io.mrkuhne.mezo.feature.season.port.SeasonMetricsPort;
import io.mrkuhne.mezo.feature.season.port.SeasonSleepPort;
import io.mrkuhne.mezo.feature.season.port.SeasonTrainPort;
import io.mrkuhne.mezo.feature.season.port.SeasonTrainPort.SessionKind;
import io.mrkuhne.mezo.feature.season.repository.SeasonRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
 *   <li><b>sessions</b> = one entry per planned session kind of the day — a weekly gym slot, a weekly sport slot, a
 *       planned run — so a gym + sport day carries <b>two</b> sessions (mezo-r36n9.131); each is done when a
 *       completed workout / sport session / run of <i>its own kind</i> exists that date (null when excused or
 *       today+). <b>dayKind</b> = {@link SeasonDayKind} of the plan. <b>sessionPlanned</b> = any session planned;
 *       <b>sessionDone</b> = every judged session done (null when none was judged);</li>
 *   <li><b>sleepOk</b> = the night ending that morning ≥ the need − 15 min (not judged today or later); the need is the active season's, else
 *       his own sleep goal (null when neither exists — never a default);</li>
 *   <li><b>excused</b> = a kímélő day ({@code excuse = kimelo}) — it leaves every count of the summary. A reasoned
 *       gym / sport / run skip ({@code excuse = skip}) excuses only <i>that</i> session: it leaves the session counts,
 *       while the day's other session, its food and its night still count.</li>
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
    /** Boop B7 K3 (mezo-r36n9.17): accepted moves — a moved gym session is judged once, on its new day. */
    private final SeasonAdjustmentPort adjustmentPort;

    public record AdherenceDay(LocalDate date, boolean judged, boolean excused, String excuse, Integer kcal,
                               Integer targetKcal, Integer proteinG, Integer targetProteinG, Boolean foodInBand,
                               boolean sessionPlanned, Boolean sessionDone, Integer sleepMin, Integer needMin,
                               Boolean sleepOk, String dayKind, List<DaySession> sessions) {
    }

    /** One planned session of a day: {@code kind} gym | sport | run; {@code done} null when excused or today+. */
    public record DaySession(String kind, boolean excused, Boolean done) {

        boolean training() {
            return !SessionKind.SPORT.key().equals(kind);
        }
    }

    /** {@code sessions*} = training + sport; {@code training*} = gym and run sessions, {@code sport*} = sport. */
    public record Summary(int foodInBand, int foodJudged, int sessionsDone, int sessionsPlanned, int nightsOk,
                          int nightsJudged, int excusedDays, int trainingDone, int trainingPlanned, int sportDone,
                          int sportPlanned) {

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
        Map<LocalDate, Set<SessionKind>> planned =
            withMoves(trainPort.plannedSessions(owner, from, to), adjustmentPort.movedSessions(owner, from, to), from, to);
        Map<LocalDate, Set<SessionKind>> done = trainPort.doneSessions(owner, from, to);
        Map<LocalDate, Set<SessionKind>> skipped = trainPort.excusedSessions(owner, from, to);
        Map<LocalDate, Integer> sleep = metricsPort.sleepMinutes(owner, from, to);
        Integer need = need(owner);

        List<AdherenceDay> out = new ArrayList<>(food.size());
        for (SeasonMealPort.FoodDay f : food) {
            LocalDate d = f.date();
            boolean past = d.isBefore(today);
            Set<SessionKind> skip = skipped.getOrDefault(d, Set.of());
            Set<SessionKind> doneKinds = done.getOrDefault(d, Set.of());
            // A skipped session was planned even when today's schedule no longer has its slot.
            Set<SessionKind> kinds = EnumSet.noneOf(SessionKind.class);
            kinds.addAll(planned.getOrDefault(d, Set.of()));
            kinds.addAll(skip);
            boolean excused = f.kimelo();
            String excuse = f.kimelo() ? "kimelo" : !skip.isEmpty() ? "skip" : null;
            boolean judged = past && !f.kimelo() && f.kcal() != null;
            Boolean inBand = judged ? Math.abs(f.kcal() - f.targetKcal()) * 10 <= f.targetKcal() : null;
            List<DaySession> sessions = new ArrayList<>(kinds.size());
            for (SessionKind k : kinds) {
                boolean off = excused || skip.contains(k);
                sessions.add(new DaySession(k.key(), off, off || !past ? null : doneKinds.contains(k)));
            }
            List<Boolean> verdicts = sessions.stream().map(DaySession::done).filter(Objects::nonNull).toList();
            Boolean sessionDone = verdicts.isEmpty() ? null : !verdicts.contains(Boolean.FALSE);
            // The day's kind is its plan: a skip of a one-off event (or a slot no longer scheduled) keeps the day's
            // own kind; only when nothing else is planned does the skipped kind name it.
            Set<SessionKind> plan = planned.getOrDefault(d, Set.of()).isEmpty() ? kinds : planned.get(d);
            String dayKind = SeasonDayKind.of(plan.stream().anyMatch(SessionKind::training),
                plan.contains(SessionKind.SPORT)).key();
            Integer sleepMin = sleep.get(d);
            Boolean sleepOk = !past || sleepMin == null || need == null ? null : sleepMin >= need - SLEEP_GRACE_MIN;
            out.add(new AdherenceDay(d, judged, excused, excuse, f.kcal(), f.targetKcal(), f.proteinG(),
                f.targetProteinG(), inBand, !kinds.isEmpty(), sessionDone, sleepMin, need, sleepOk, dayKind,
                List.copyOf(sessions)));
        }
        return out;
    }

    /**
     * The plan with the ledger's accepted moves applied (Boop B7 K3): the gym session leaves its old day and is planned
     * on its new one, so it counts once — not missed on the old day, not doubled. A move never targets a gym day
     * (decision #71), so the new day gains the session rather than merging two. {@code planned} covers
     * {@code from..to}; a move whose old day lies outside it still brings its session to the new day.
     */
    static Map<LocalDate, Set<SessionKind>> withMoves(Map<LocalDate, Set<SessionKind>> planned,
            List<SeasonAdjustmentPort.Move> moves, LocalDate from, LocalDate to) {
        if (moves.isEmpty()) {
            return planned;
        }
        Map<LocalDate, Set<SessionKind>> out = new HashMap<>();
        planned.forEach((d, kinds) -> out.put(d, kinds.isEmpty() ? EnumSet.noneOf(SessionKind.class) : EnumSet.copyOf(kinds)));
        for (SeasonAdjustmentPort.Move m : moves) {
            boolean oldInRange = !m.from().isBefore(from) && !m.from().isAfter(to);
            Set<SessionKind> old = out.get(m.from());
            if (oldInRange && (old == null || !old.remove(SessionKind.GYM))) {
                continue; // nothing planned to move (the schedule changed since) — the move judges nothing
            }
            if (!m.to().isBefore(from) && !m.to().isAfter(to)) {
                out.computeIfAbsent(m.to(), d -> EnumSet.noneOf(SessionKind.class)).add(SessionKind.GYM);
            }
        }
        out.values().removeIf(Set::isEmpty);
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
        int trainingDone = 0;
        int trainingPlanned = 0;
        int sportDone = 0;
        int sportPlanned = 0;
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
            for (DaySession session : d.sessions()) {
                if (session.done() == null) {
                    continue;
                }
                int hit = session.done() ? 1 : 0;
                if (session.training()) {
                    trainingPlanned++;
                    trainingDone += hit;
                } else {
                    sportPlanned++;
                    sportDone += hit;
                }
            }
            nightsJudged += d.sleepOk() != null ? 1 : 0;
            nightsOk += Boolean.TRUE.equals(d.sleepOk()) ? 1 : 0;
        }
        return new Summary(inBand, judged, trainingDone + sportDone, trainingPlanned + sportPlanned, nightsOk,
            nightsJudged, excused, trainingDone, trainingPlanned, sportDone, sportPlanned);
    }
}

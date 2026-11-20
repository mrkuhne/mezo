package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.feature.season.entity.SeasonDraftJson;
import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonNumbersJson;
import io.mrkuhne.mezo.feature.season.port.SeasonGoalPort;
import io.mrkuhne.mezo.feature.season.port.SeasonGoalPort.GoalFields;
import io.mrkuhne.mezo.feature.season.port.SeasonMetricsPort;
import io.mrkuhne.mezo.feature.season.port.SeasonSleepPort;
import io.mrkuhne.mezo.feature.season.port.SeasonTrainPort;
import io.mrkuhne.mezo.feature.season.repository.SeasonRepository;
import io.mrkuhne.mezo.feature.season.service.SeasonTodoRules.Todo;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The live consequence preview of a season change (spec §5.3) — <b>persists nothing</b>. Every number comes from the
 * goal engine run on a detached draft goal over the draft schedule ({@link SeasonGoalPort#previewTargets}), the
 * sleep rule ({@link SleepNeedRule}) and the feasibility band; a value the server cannot compute is null.
 *
 * <p>The served-target model (mezo-tb3s2) means a training day's kcal is base + one session's movement + the goal
 * balance: adding a weekly session turns a rest day into a training day and raises the weekly energy, but does not
 * raise the training-day target itself — the preview shows exactly what the day will serve.
 */
@Service
@RequiredArgsConstructor
public class SeasonPreviewService {

    static final BigDecimal BAND_HALF_KG = BigDecimal.ONE;
    static final List<String> DEFAULT_GUARDS = List.of("strength", "muscle");

    private final SeasonRepository seasonRepository;
    private final SeasonGoalPort goalPort;
    private final SeasonTrainPort trainPort;
    private final SeasonSleepPort sleepPort;
    private final SeasonMetricsPort metricsPort;

    public record Warning(String key, String text) {
    }

    public record Preview(SeasonNumbersJson before, SeasonNumbersJson after, List<Todo> todo, List<Warning> warnings,
                          String fingerprint) {
    }

    /** One draft's numbers, its guard warnings and the goal it would write. */
    public record Computed(SeasonNumbersJson numbers, List<Warning> warnings, GoalFields goal) {
    }

    /** Before = the season as it stands, after = the draft. */
    @Transactional(readOnly = true)
    public Preview preview(UUID owner, UUID seasonId, SeasonDraftJson draft) {
        SeasonEntity season = requireEditable(owner, seasonId);
        SeasonDraftJson current = currentDraft(owner, season);
        Computed before = compute(owner, season, current);
        Computed after = compute(owner, season, draft);
        return new Preview(before.numbers(), after.numbers(),
            SeasonTodoRules.todo(before.numbers(), after.numbers(), current, draft, null),
            after.warnings(), fingerprint(owner, season));
    }

    /** No season yet (the new-season summary): before = the live goal, the current slots and the sleep goal. */
    @Transactional(readOnly = true)
    public Preview previewDraft(UUID owner, SeasonDraftJson draft) {
        Optional<SeasonGoalPort.GoalView> live = goalPort.liveActive(owner);
        SeasonDraftJson liveSchedule = withLiveSchedule(owner, draft);
        Computed before = live
            .map(g -> computeFields(owner, g.id(), g.fields(), liveSchedule, sleepBase(owner)))
            .orElseGet(() -> compute(owner, null, liveSchedule));
        Computed after = compute(owner, null, draft);
        return new Preview(before.numbers(), after.numbers(),
            SeasonTodoRules.todo(before.numbers(), after.numbers(), liveSchedule, draft, null),
            after.warnings(), "");
    }

    /** The numbers of {@code draft} for {@code season} (null = no season yet). Read-only. */
    public Computed compute(UUID owner, SeasonEntity season, SeasonDraftJson draft) {
        return computeFields(owner, season == null ? null : season.getGoalId(), goalFields(owner, season, draft), draft,
            sleepBase(owner));
    }

    /**
     * The goal a draft would write: the season goal's start weight (else his latest weigh-in, else the live goal's
     * start), the live goal's guards (else strength + muscle), the window per {@link SeasonDraftMath}.
     */
    public GoalFields goalFields(UUID owner, SeasonEntity season, SeasonDraftJson draft) {
        UUID goalId = season == null ? null : season.getGoalId();
        Optional<SeasonGoalPort.GoalView> seasonGoal = goalId == null ? Optional.empty() : goalPort.goal(owner, goalId);
        Optional<SeasonGoalPort.GoalView> live = seasonGoal.isPresent() ? seasonGoal : goalPort.liveActive(owner);
        BigDecimal startWeight = seasonGoal.map(g -> g.fields().startWeightKg())
            .or(() -> metricsPort.latestWeightKg(owner))
            .or(() -> live.map(g -> g.fields().startWeightKg()))
            .orElseThrow(SeasonPreviewService::profileRequired);
        List<String> guards = live.map(g -> g.fields().guards()).filter(g -> !g.isEmpty()).orElse(DEFAULT_GUARDS);
        return SeasonDraftMath.goalFields(draft, startWeight, guards);
    }

    /** The season as it stands, as a draft: the accepted draft, with the live slots and sleep anchor once active. */
    public SeasonDraftJson currentDraft(UUID owner, SeasonEntity season) {
        SeasonDraftJson d = season.getDraft();
        return SeasonEntity.STATUS_ACTIVE.equals(season.getStatus()) ? withLiveSchedule(owner, d) : d;
    }

    /** The fingerprint of everything a preview of {@code season} depends on. */
    public String fingerprint(UUID owner, SeasonEntity season) {
        Optional<SeasonGoalPort.GoalView> goal = goalPort.goal(owner, season.getGoalId());
        String weighIn = metricsPort.latestWeightKg(owner).map(BigDecimal::toPlainString).orElse("-")
            + "|" + metricsPort.weighInDaysSince(owner, LocalDate.of(2000, 1, 1));
        List<UUID> linked = goalPort.linkedMesocycles(owner, season.getGoalId());
        Optional<SeasonTrainPort.Block> block = trainPort.activeMesocycle(owner)
            .or(() -> linked.isEmpty() ? Optional.empty() : trainPort.mesocycle(owner, linked.get(linked.size() - 1)));
        return SeasonFingerprint.of(season, goal, trainPort.currentSchedule(owner), metricsPort.trend(owner), weighIn,
            sleepPort.get(owner), block);
    }

    /** The sleep rule's base: the active season's stored base, else his own sleep goal, else 7 h 30. */
    public int sleepBase(UUID owner) {
        Optional<SeasonEntity> active = seasonRepository.findActive(owner);
        if (active.isPresent() && active.get().getSleepBaseMin() != null) {
            return active.get().getSleepBaseMin();
        }
        SeasonSleepPort.SleepGoal g = sleepPort.get(owner);
        return SleepNeedRule.base(g.isSet() ? g.targetMinutes() : null);
    }

    SeasonEntity requireEditable(UUID owner, UUID seasonId) {
        SeasonEntity s = seasonRepository.findByIdAndCreatedBy(seasonId, owner)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        if (SeasonEntity.STATUS_CLOSED.equals(s.getStatus())) {
            throw new SystemRuntimeErrorException(SystemMessage.error("SEASON_NOT_EDITABLE").build(), HttpStatus.CONFLICT);
        }
        return s;
    }

    private Computed computeFields(UUID owner, UUID goalId, GoalFields fields, SeasonDraftJson schedule, int sleepBase) {
        SeasonGoalPort.DraftEnergy energy = new SeasonGoalPort.DraftEnergy() {
            @Override
            public BigDecimal weeklyEat(BigDecimal rest) {
                return trainPort.draftEat(schedule, rest);
            }

            @Override
            public int trainDayMovementKcal(BigDecimal rest) {
                return trainPort.trainDayMovementKcal(schedule, rest);
            }
        };
        SeasonGoalPort.DraftTargets t = goalPort.previewTargets(owner, goalId, fields, energy, LocalDate.now())
            .orElseThrow(SeasonPreviewService::profileRequired);
        int gym = schedule.gymDaysOrEmpty().size();
        int sport = schedule.sportOrEmpty().size();
        int need = SleepNeedRule.sleepNeedMinutes(sleepBase, gym, sport);
        SeasonSleepPort.SleepGoal sleep = sleepPort.get(owner);
        String anchor = schedule.sleepAnchor() != null ? schedule.sleepAnchor().anchor() : sleep.anchor();
        String anchorTime = schedule.sleepAnchor() != null ? schedule.sleepAnchor().time() : sleep.anchorTime();
        Integer restDay = SeasonDraftMath.activeDays(schedule) >= 7 ? null : t.restDay().kcal();

        boolean maintain = "maintain".equals(fields.trajectory());
        LocalDate targetDate = null;
        Integer weeksToTarget = null;
        String verdict = null;
        BigDecimal kgPerWeek = null;
        BigDecimal bandLow = null;
        BigDecimal bandHigh = null;
        if (maintain) {
            bandLow = fields.startWeightKg().subtract(BAND_HALF_KG);
            bandHigh = fields.startWeightKg().add(BAND_HALF_KG);
        } else {
            weeksToTarget = SeasonDraftMath.goalWeeks(fields);
            targetDate = fields.targetDate();
            verdict = goalPort.feasibility(fields).verdict();
            if (fields.targetWeightKg() != null && weeksToTarget > 0) {
                kgPerWeek = fields.targetWeightKg().subtract(fields.startWeightKg())
                    .divide(BigDecimal.valueOf(weeksToTarget), 2, RoundingMode.HALF_UP);
            }
        }
        SeasonNumbersJson numbers = new SeasonNumbersJson(t.trainDay().kcal(), restDay, t.trainDay().proteinG(),
            t.trainDay().carbsG(), need, SleepNeedRule.bedtime(anchor, anchorTime, need), targetDate, weeksToTarget,
            verdict, kgPerWeek, bandLow, bandHigh, gym, sport);
        return new Computed(numbers, warnings(fields, verdict, t.guards()), fields);
    }

    private SeasonDraftJson withLiveSchedule(UUID owner, SeasonDraftJson d) {
        SeasonTrainPort.Schedule s = trainPort.currentSchedule(owner);
        SeasonSleepPort.SleepGoal sleep = sleepPort.get(owner);
        return new SeasonDraftJson(d.title(), d.trajectory(), d.targetWeightKg(), d.ratePctPerWeek(), d.kgPerWeek(),
            d.startDate(), d.weeks(), s.gymDays(), s.gymTime(), s.sport(),
            new SeasonDraftJson.SleepAnchor(sleep.anchor(), sleep.anchorTime()), d.allowedRecipeIds(), d.block());
    }

    private static List<Warning> warnings(GoalFields fields, String verdict, SeasonGoalPort.GuardFlags guards) {
        List<Warning> out = new ArrayList<>();
        if (guards.strengthBreached()) {
            out.add(new Warning("strength", "Ennyi edzés mellett ilyen kevés kalóriától gyengülhetsz: a nagy"
                + " gyakorlatokban valószínűleg megáll a fejlődés."));
        }
        if ("cut".equals(fields.trajectory())
            && ("aggressive".equals(verdict) || Boolean.FALSE.equals(guards.rateWithinCap()))) {
            out.add(new Warning("rate", "Ilyen tempónál izmot is veszítenél, nem csak zsírt."));
        }
        for (String muscle : guards.musclesBelow()) {
            out.add(new Warning("muscle_" + muscle, "%s heti munkája a minimum alá kerülne.".formatted(muscleHu(muscle))));
        }
        return out;
    }

    /** The volume log's muscle keys as a Hungarian subject ("A mell"); an unmapped key falls back to itself. */
    private static String muscleHu(String muscle) {
        String noun = switch (muscle == null ? "" : muscle.toLowerCase(Locale.ROOT)) {
            case "shoulder", "shoulders", "delts" -> "váll";
            case "chest" -> "mell";
            case "back", "lats" -> "hát";
            case "biceps" -> "bicepsz";
            case "triceps" -> "tricepsz";
            case "quad", "quads" -> "comb";
            case "ham", "hamstrings" -> "combhajlító";
            case "glute", "glutes" -> "far";
            case "calf", "calves" -> "vádli";
            case "core", "abs" -> "törzs";
            default -> muscle;
        };
        return "A " + noun;
    }

    static SystemRuntimeErrorException profileRequired() {
        return new SystemRuntimeErrorException(SystemMessage.error("SEASON_PROFILE_REQUIRED").build(), HttpStatus.CONFLICT);
    }
}

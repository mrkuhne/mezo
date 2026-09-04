package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.proactive.config.SetupCheckProperties;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Setup checks (S3, bd mezo-d58h.3, spec 2026-09-03 §4 setup table) — the user's CONFIGURATION
 * contradicts what coaching needs. Not flags: these read configuration rather than metric series,
 * run on their own daily cron rather than the flag spine, and emit an {@code advice} card (S4, bd
 * mezo-d58h.4) that re-emits at most weekly until the configuration stops contradicting them.
 *
 * <p>PURE CODE, like {@code InterventionService}: the text is config, never an LLM call, so there
 * is nothing to tag with LlmCallContextHolder.
 *
 * <p>Checks are ordered and first-wins — a user with no sleep goal at all gets the goal card, not
 * a feasibility card computed against a goal that does not exist. Since S4 (mezo-d58h.4) the card
 * itself is an {@code advice} row written by {@link AdviceCardService}, which applies the spec §4
 * severity order across flags AND setup checks; this service only decides WHICH check speaks and
 * whether its weekly window is open.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class SetupCheckService {

    public static final String CHECK_MISSING_SLEEP_GOAL = "missing_sleep_goal";
    /** Task 4 (S3) adds the plan-feasibility check behind this same entry point. */
    public static final String CHECK_PLAN_FEASIBILITY = "plan_feasibility";
    public static final String EYEBROW = "Mezo · beállítás";

    private static final String MISSING_SLEEP_GOAL_TEXT =
        "Nincs még alvás-célod beállítva, így az alvásról csak találgatni tudok. "
        + "Állítsd be a cél alvásidőt és a horgonyt (ébredés vagy lefekvés) — onnantól "
        + "az alvás-kártya és a terv-javaslatok a te számaidra szólnak.";

    private final SleepGoalRepository sleepGoalRepository;
    private final CompanionMessageRepository companionMessageRepository;
    private final SetupCheckProperties properties;
    private final PlanFeasibilityCalculator planFeasibilityCalculator;
    private final AdviceCardService adviceCardService;

    /** The first check that fires for {@code userId} today, or empty when the setup is sound (or
     *  when a more severe advice card already owns the day — {@link AdviceCardService}). */
    @Transactional
    public Optional<CompanionMessageEntity> runFor(UUID userId) {
        LocalDate today = LocalDate.now();
        // Read the REPOSITORY, never SleepGoalService/SleepAnchorResolver: both fall back to a
        // config-default ghost, so the missing-row condition is invisible through them.
        if (sleepGoalRepository.findByCreatedByAndDeletedFalse(userId).isEmpty()) {
            return emit(userId, CHECK_MISSING_SLEEP_GOAL, MISSING_SLEEP_GOAL_TEXT);
        }
        return planFeasibilityCalculator.evaluate(userId, today)
            .filter(verdict -> !verdict.feasible())
            .flatMap(verdict -> emit(userId, CHECK_PLAN_FEASIBILITY, feasibilityText(verdict)));
    }

    /** Adjectival Hungarian weekday names, 0=Monday..6=Sunday — the same index convention as
     *  {@code GymScheduleSlotEntity.dayOfWeek}/{@code SportScheduleSlotEntity.dayOfWeek} (S3
     *  day-pairing correction, bd mezo-d58h.3). Names the sport half's binding evening in the
     *  card instead of asserting an unattributed figure. */
    private static final List<String> WEEKDAY_ADJECTIVES = List.of(
        "hétfői", "keddi", "szerdai", "csütörtöki", "pénteki", "szombati", "vasárnapi");

    /** Config-free prose from the verdict's own numbers: lights-out, what actually binds, and the
     *  misfit. The two sources say genuinely different things (a late-ending evening session vs.
     *  an observed bedtime later than the plan needs), so each gets its own sentence and its own
     *  lever — the parenthetical this replaced filled {@code (%s helyett)} with
     *  {@code latestConstraint} (the ACTUAL, binding time), which read as "instead of the very
     *  thing that is happening" and was circular for the bedtime source ("your measured bedtime
     *  pushes bedtime out"). */
    private String feasibilityText(PlanFeasibilityCalculator.Verdict verdict) {
        if (PlanFeasibilityCalculator.SOURCE_BEDTIME.equals(verdict.constraintSource())) {
            return ("A terved nem fér bele a hetedbe: %s-kor kellene lekapcsolnod a villanyt, de "
                + "a mért lefekvésed valójában %s-kor van, ami %d perccel későbbi ennél. Vagy "
                + "tolod a reggeli ébresztőt később, vagy korábban fekszel le, hogy beleférj.")
                .formatted(verdict.requiredLightsOut(), verdict.latestConstraint(), verdict.misfitMin());
        }
        // constraintSource == SOURCE_SPORT always carries a bindingDay (the day-paired slot that
        // bound the verdict) — the card names the actual evening rather than an unattributed sport
        // schedule.
        String dayAdjective = verdict.bindingDay() != null
            ? WEEKDAY_ADJECTIVES.get(verdict.bindingDay()) + " "
            : "";
        return ("A terved nem fér bele a hetedbe: %s-kor kellene lekapcsolnod a villanyt, de a "
            + dayAdjective + "esti sportod %s-kor ér véget, ami %d perccel későbbi ennél. Vagy "
            + "tolod a reggeli ébresztőt később, vagy rövidíted/ritkítod az esti edzéseket, hogy "
            + "beleférj.")
            .formatted(verdict.requiredLightsOut(), verdict.latestConstraint(), verdict.misfitMin());
    }

    /** Hands the check to the advice-card layer unless this same check already spoke inside the
     *  re-emit window. The card's severity rank (setup cards sit below every flag) is applied by
     *  {@link AdviceCardService}, so a quiet return here can mean either "already said this week"
     *  or "a more severe card owns today" — both are logged. */
    private Optional<CompanionMessageEntity> emit(UUID userId, String checkKey, String text) {
        if (inReEmitWindow(userId, checkKey)) {
            log.info("Setup check {} skipped for user {}: inside the re-emit window", checkKey, userId);
            return Optional.empty();
        }
        return adviceCardService.deliver(userId,
            AdviceCandidate.fromSetupCheck(checkKey, EYEBROW, List.of(text), text));
    }

    /** The same CHECK must not repeat inside its window — envelope {@code setupKey}s of recent
     *  cards, filtered in memory (single-user volumes). Reads BOTH kinds: {@code advice} is what
     *  S4 writes, {@code setup} is what pre-S4 rows carry. */
    private boolean inReEmitWindow(UUID userId, String checkKey) {
        Instant since = Instant.now().minus(properties.reEmitHours(), ChronoUnit.HOURS);
        return Stream.of(CompanionMessageEntity.KIND_ADVICE, CompanionMessageEntity.KIND_SETUP)
            .flatMap(kind -> companionMessageRepository
                .findByCreatedByAndKindAndGeneratedAtAfter(userId, kind, since).stream())
            .anyMatch(row -> checkKey.equals(row.getContent().setupKey()));
    }
}

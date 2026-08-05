package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.api.dto.HabitStrength;
import io.mrkuhne.mezo.api.dto.HabitSummaryResponse;
import io.mrkuhne.mezo.api.dto.IntentionDayResponse;
import io.mrkuhne.mezo.api.dto.IntentionFocusResponse;
import io.mrkuhne.mezo.api.dto.RitualDayResponse;
import io.mrkuhne.mezo.feature.companion.TodayActivitySource;
import io.mrkuhne.mezo.feature.companion.TodayQuestSource;
import io.mrkuhne.mezo.feature.habit.service.HabitService;
import io.mrkuhne.mezo.feature.intention.service.IntentionService;
import io.mrkuhne.mezo.feature.ritual.service.RitualService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * V0.5 read tool over one day's "discipline" (mezo-xixu): quests + habits + the daily intention
 * (creed/foci/reflection) + napzárás close state + logged activities, for a caller-given date
 * (default today) — a date-parameterized sibling of {@code ContextSnapshotAssembler#practiceBlock}
 * (which is hardwired to "today"). Read-only, ownership-scoped via {@link ToolContext} (never model
 * args), honest "nincs adat"/ghost renders per each backing service's own philosophy — spec §5/§6.
 *
 * <p>Every collaborator is independently switch-gated (HABIT/INTENTION/RITUAL/ACTIVITY_SWITCH, plus
 * the quest port's own QUEST_SWITCH) — read defensively via {@link ObjectProvider} (the
 * {@code BiometricsTools#sleepGoalService} / {@code ContextSnapshotAssembler} precedent) so a
 * disabled sub-feature degrades its own line to "nincs adat" rather than failing Spring context
 * startup.
 *
 * <p><b>Read-only verification per collaborator (none of these may write on this read path):</b>
 * <ul>
 *   <li>{@link TodayQuestSource#todayStats} — a plain {@code DailyQuestRepository} read
 *       (verified: {@code quest/service/TodayQuestAdapter}); deliberately NEVER
 *       {@code QuestService#getDay}, which lazily generates the day's rows and awards XP on
 *       derived-quest evaluation (not read-only).</li>
 *   <li>{@link HabitService#summary} is {@code @Transactional(readOnly = true)} (verified,
 *       re-verified mezo-n5e9.1 review finding 3 — a prior revision had it calling
 *       {@code HabitCatalogService#ensureCatalog} twice, i.e. bootstrapping 17 catalog rows for
 *       every dormant account on every companion turn; {@code summary} is now non-bootstrapping —
 *       a user who never touched habits gets an honest empty summary here, and gets their catalog
 *       on their first real {@code getDay}) — used INSTEAD of {@code HabitService#getDay}, which
 *       IS write-transactional (lazily materializes today's rows, closes stale pending days,
 *       evaluates + awards intraday habits). Trade-off: {@code summary} has no {@code date}
 *       parameter — it is always "as of today" (last 30/28 days ending {@code LocalDate.now()}),
 *       so this block does NOT change with a caller-given past/future {@code date}. Documented
 *       limitation, not a bug.</li>
 *   <li>{@link IntentionService#getDay} is {@code @Transactional(readOnly = true)} (verified) —
 *       safe to call directly for the resolved date.</li>
 *   <li>{@link RitualService#getDay} is {@code @Transactional(readOnly = true)} (verified) — safe
 *       to call directly for the resolved date.</li>
 *   <li>{@code ActivityService#getDay} is {@code @Transactional(readOnly = true)} (verified,
 *       distinct from the write paths {@code create}/{@code categorize}) — read-only, BUT consumed
 *       through the companion-owned {@link TodayActivitySource} port
 *       ({@code activity/service/DailyActivityAdapter}, a plain {@code ActivityLogRepository}
 *       read) rather than {@code ActivityService} directly: {@code feature.activity} already
 *       depends on {@code feature.companion} (both directly via {@code ActivityClassifier}'s
 *       {@code CompanionLlm} use, and transitively via {@code feature.quest}), so a direct
 *       {@code companion.tools → activity.service.ActivityService} import would close a NEW
 *       2-/3-slice cycle — {@code ArchitectureTest#feature_slices_are_cycle_free} is a
 *       {@code FreezingArchRule} that only tolerates the two PRE-EXISTING frozen cycles
 *       (biometrics↔goal, meal↔recipe). The {@link TodayQuestSource} pattern, applied a second
 *       time.</li>
 * </ul>
 *
 * <p><b>Active challenges are deliberately NOT composed.</b> {@code ProactiveChallengeService
 * #getChallenges} is write-transactional (lazily generates the first proposal via
 * {@code ChallengeGenerator.generate} + resolves accepted-challenge outcomes via
 * {@code ChallengeOutcomeEvaluator.evaluate}) — calling it from a read tool would violate the
 * read-only contract. A direct {@code ChallengeRepository} read would bypass that write, but it
 * would also open a NEW {@code companion → proactive} package import; {@code proactive} already
 * depends on {@code companion} (its generators call {@code CompanionLlm}), so that new edge would
 * form a fresh 2-slice cycle — {@code ArchitectureTest#feature_slices_are_cycle_free} is a
 * {@code FreezingArchRule} that only tolerates the two PRE-EXISTING frozen cycles (biometrics↔goal,
 * meal↔recipe) and fails on anything new. Resolving this cleanly needs a companion-owned read port
 * (the {@link TodayQuestSource} pattern) — out of scope for this tool; DONE_WITH_CONCERNS.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PracticeTools {

    /** Activities rendered/audited per call — token budget by construction (the TrainTools/FuelTools precedent). */
    private static final int ACTIVITY_LIMIT = 5;

    private final ObjectProvider<TodayQuestSource> todayQuestSource;
    private final ObjectProvider<HabitService> habitService;
    private final ObjectProvider<IntentionService> intentionService;
    private final ObjectProvider<RitualService> ritualService;
    private final ObjectProvider<TodayActivitySource> todayActivitySource;

    @Tool(name = "get_daily_practice", description = "Egy nap 'fegyelme': küldetések, szokások, "
            + "napi szándék (vezérelv + fókuszok + esti reflexió), nap lezárva-e, tevékenységek. "
            + "Használd, amikor a user a napi rutinjáról, küldetéseiről, szokásairól, szándékáról "
            + "vagy a nap lezárásáról kérdez.")
    public String getDailyPractice(
            @ToolParam(required = false, description = "ISO dátum (ÉÉÉÉ-HH-NN) — alapértelmezés: ma.")
            String date,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        LocalDate d = parseDate(date);
        StringBuilder b = new StringBuilder("Napi gyakorlat (").append(d).append("):");
        b.append("\nKüldetések: ").append(renderQuest(userId, d));
        b.append("\nSzokások (ma állapot szerint): ").append(renderHabits(userId));
        b.append("\nSzándék: ").append(renderIntention(userId, d));
        b.append("\nNapzárás: ").append(renderRitual(userId, d));
        b.append("\nTevékenységek: ").append(renderActivities(userId, d));
        ToolContexts.audit(toolContext).addRef("Practice", d.toString());
        return b.toString();
    }

    /** An unparsable/missing date param falls back to today rather than failing the whole call (the
     *  TrainTools#parseDate idiom). */
    private static LocalDate parseDate(String date) {
        if (date == null || date.isBlank()) {
            return LocalDate.now();
        }
        try {
            return LocalDate.parse(date.trim());
        } catch (DateTimeParseException e) {
            return LocalDate.now();
        }
    }

    /** Non-rerolled quest rows for the resolved date via the read-only {@link TodayQuestSource} port. */
    private String renderQuest(UUID userId, LocalDate date) {
        TodayQuestSource source = todayQuestSource.getIfAvailable();
        TodayQuestSource.Stats stats = source == null ? null : source.todayStats(userId, date);
        if (stats == null || stats.total() == 0) {
            return ToolText.NO_DATA;
        }
        return stats.completed() + "/" + stats.total() + " lezárva";
    }

    /** Perfect-chain-day counts (never "nincs adat" — an honest zero per {@link HabitService}'s own
     *  doc) plus any habit with real 28-day signal (done28/missed28 &gt; 0 — the fixed-taxonomy
     *  ghost rows at 0/0 are filtered out, the {@code GrowthTools#appendSkillLines} precedent). */
    private String renderHabits(UUID userId) {
        HabitService service = habitService.getIfAvailable();
        if (service == null) {
            return ToolText.NO_DATA;
        }
        HabitSummaryResponse summary = service.summary(userId);
        StringBuilder b = new StringBuilder("reggeli ").append(summary.getPerfectMorningDays30())
                .append(", esti ").append(summary.getPerfectEveningDays30())
                .append(" tökéletes nap (30 nap)");
        String lines = summary.getHabits().stream()
                .filter(h -> (h.getDone28() != null && h.getDone28() > 0)
                        || (h.getMissed28() != null && h.getMissed28() > 0))
                .map(PracticeTools::habitLine)
                .collect(Collectors.joining(", "));
        if (!lines.isEmpty()) {
            b.append("; ").append(lines);
        }
        return b.toString();
    }

    private static String habitLine(HabitStrength h) {
        StringBuilder line = new StringBuilder(h.getKey()).append(": ").append(h.getDone28()).append("/28");
        if (h.getStrengthPct() != null) {
            line.append(" (").append(h.getStrengthPct()).append("%)");
        }
        return line.toString();
    }

    /** Standing creed + the resolved date's foci + (if present) evening reflection. */
    private String renderIntention(UUID userId, LocalDate date) {
        IntentionService service = intentionService.getIfAvailable();
        if (service == null) {
            return ToolText.NO_DATA;
        }
        IntentionDayResponse intention = service.getDay(userId, date);
        StringBuilder b = new StringBuilder("hitvallás — ")
                .append(intention.getCreed() == null ? ToolText.NO_DATA : intention.getCreed());
        b.append("; mai fókusz: ").append(intention.getFoci().isEmpty() ? ToolText.NO_DATA
                : intention.getFoci().stream().map(IntentionFocusResponse::getText)
                        .collect(Collectors.joining(", ")));
        if (intention.getReflection() != null) {
            b.append("; esti reflexió: ").append(huReflection(intention.getReflection()));
        }
        return b.toString();
    }

    /** Raw enum value ("yes"/"partial"/"no") would leak English into an otherwise-Hungarian result
     *  (the {@code ContextSnapshotAssembler#huReflection} precedent). */
    private static String huReflection(IntentionDayResponse.ReflectionEnum reflection) {
        return switch (reflection) {
            case YES -> "igen";
            case PARTIAL -> "részben";
            case NO -> "nem";
        };
    }

    /** Whether the resolved date's napzárás is closed — never "nincs adat" once the service itself
     *  is available (an unclosed day is a real, honest "nyitva" state, not an absence). */
    private String renderRitual(UUID userId, LocalDate date) {
        RitualService service = ritualService.getIfAvailable();
        if (service == null) {
            return ToolText.NO_DATA;
        }
        RitualDayResponse ritual = service.getDay(userId, date);
        return Boolean.TRUE.equals(ritual.getClosed()) ? "zárva" : "nyitva";
    }

    /** The resolved date's logged activities (text + awarded XP) via the read-only
     *  {@link TodayActivitySource} port, capped at {@link #ACTIVITY_LIMIT}. */
    private String renderActivities(UUID userId, LocalDate date) {
        TodayActivitySource source = todayActivitySource.getIfAvailable();
        List<TodayActivitySource.ActivityLine> activities =
                source == null ? List.of() : source.activitiesForDay(userId, date);
        if (activities.isEmpty()) {
            return ToolText.NO_DATA;
        }
        return activities.stream().limit(ACTIVITY_LIMIT)
                .map(a -> a.text() + " (" + a.xpAwarded() + " XP)")
                .collect(Collectors.joining(", "));
    }
}

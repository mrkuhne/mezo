package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.api.dto.GoalPlanLinkResponse;
import io.mrkuhne.mezo.api.dto.GoalTimelineResponse;
import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightTrendService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.goal.service.GoalTimelineService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * V0.5 read tool over the goal feature — scoped since mezo-xixu (was the single-purpose
 * {@code get_goal_progress}). Pure composition: the goal entity + weight trend (scope=progress) +
 * the engine's persisted {@code prescription} jsonb — segments/guardStatus/feasibility, ALL written
 * only by {@code GoalEngineService.evaluate} (scope=recept/guards/feasibility) — + read-only
 * {@link GoalTimelineService#getTimeline} (scope=timeline). {@code evaluate} itself is a WRITE and
 * must never be called from a tool.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class GoalTools {

    /** get_goal's supported scope values; anything else (incl. null) falls back to "progress". */
    private static final List<String> GOAL_SCOPES =
            List.of("progress", "recept", "timeline", "guards", "feasibility");

    /** The honest placeholder for recept/guards/feasibility before the goal's first evaluate (G5). */
    private static final String NOT_EVALUATED = "még nincs kiértékelve";

    private final GoalRepository goalRepository;
    private final WeightTrendService weightTrendService;
    private final GoalTimelineService goalTimelineService;

    @Tool(name = "get_goal", description = "Az aktív cél. scope=progress (alapértelmezés) — "
            + "kezdő/cél/aktuális trendsúly, hét sorszáma, terv szerinti és tényleges heti ütem, "
            + "e heti recept (kcal/fehérje) rövid összegzése. scope=recept — a cél teljes szegmentált "
            + "receptje: időszakonként kcal, fehérje, alváscél, pihenőnapok, tervezett heti ütem és "
            + "indoklás. scope=guards — az erő- és izomkorlátok állása: e1RM trend és megsértés, heti "
            + "minimum szett/izomcsoport és elmaradó izomcsoportok. scope=feasibility — a cél "
            + "reálisságának verdiktje és megjegyzései. scope=timeline — a célhoz rendelt tervek "
            + "(mezociklus/futásblokk) hetekre bontva, plusz a lefedetlen hetek. A recept/guards/"
            + "feasibility scope csak kiértékelt (aktivált) célra ad adatot; a timeline scope ettől "
            + "függetlenül a célhoz rendelt tervektől (plan linkek) függ, nem a kiértékeléstől. "
            + "Használd, amikor a user a céljáról, a receptjéről/kalóriacéljáról, a korlátairól, a cél "
            + "reálisságáról, vagy a célhoz rendelt tervekről/lefedettségéről (pl. milyen tervek fedik "
            + "le a célt, mely hetek nincsenek lefedve) kérdez. scope: progress (alapértelmezés), "
            + "recept, timeline, guards, feasibility.")
    public String getGoal(
            @ToolParam(required = false, description = "progress|recept|timeline|guards|feasibility "
                    + "(alapértelmezés: progress).") String scope,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        GoalEntity goal = goalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")
                .stream().findFirst().orElse(null);
        if (goal == null) {
            return "Cél: nincs aktív cél";
        }
        return switch (normalizeScope(scope)) {
            case "recept" -> renderRecept(goal, toolContext);
            case "guards" -> renderGuards(goal, toolContext);
            case "feasibility" -> renderFeasibility(goal, toolContext);
            case "timeline" -> renderTimeline(userId, goal, toolContext);
            default -> renderProgress(goal, userId, toolContext);
        };
    }

    private static String normalizeScope(String scope) {
        if (scope == null) {
            return "progress";
        }
        String s = scope.trim().toLowerCase();
        return GOAL_SCOPES.contains(s) ? s : "progress";
    }

    /** scope=progress (default) — the original get_goal_progress body, unchanged. */
    private String renderProgress(GoalEntity goal, UUID userId, ToolContext toolContext) {
        LocalDate today = LocalDate.now();
        // week derived from startDate (the snapshot's idiom) — the stored week can lag
        long week = ChronoUnit.DAYS.between(goal.getStartDate(), today) / 7 + 1;
        StringBuilder b = new StringBuilder("Cél: ").append(goal.getTitle())
                .append(" (").append(goal.getTrajectory()).append("), ").append(week).append(". hét; ")
                .append(ToolText.num(goal.getStartWeightKg())).append(" → ")
                .append(goal.getTargetWeightKg() != null ? ToolText.num(goal.getTargetWeightKg()) : "?")
                .append(" kg, ").append(goal.getStartDate()).append(" → ").append(goal.getTargetDate());
        WeightTrendResponse trend = weightTrendService.computeTrend(userId);
        if (trend.getLatestTrendKg() != null && !trend.getEwmaSeries().isEmpty()
                && trend.getDataSufficiency() != WeightTrendResponse.DataSufficiencyEnum.NONE) {
            b.append("; trendsúly most ").append(ToolText.num(trend.getLatestTrendKg())).append(" kg");
            if (goal.getStartWeightKg() != null) {
                b.append(" (eddig ").append(ToolText.num(
                        trend.getLatestTrendKg().subtract(goal.getStartWeightKg()))).append(" kg)");
            }
            if (trend.getWeeklyRateKgPerWeek() != null) {
                b.append(", tényleges ütem ").append(ToolText.num(trend.getWeeklyRateKgPerWeek())).append(" kg/hét");
            }
        } else {
            b.append("; trendsúly: ").append(ToolText.NO_DATA);
        }
        if (goal.getRateTargetPctPerWeek() != null) {
            b.append(", terv-ütem ").append(ToolText.num(goal.getRateTargetPctPerWeek())).append("%/hét");
        }
        GoalPrescriptionJson.Segment seg = GoalPrescriptionJson.currentSegment(goal.getPrescription(), week);
        if (seg != null) {
            b.append("; e heti recept: ").append(seg.kcal()).append(" kcal, ")
                    .append(seg.proteinG()).append(" g fehérje");
        }
        ToolContexts.audit(toolContext).addRef("Goal", goal.getTitle());
        return b.toString();
    }

    /** scope=recept (mezo-xixu) — the goal's full segmented prescription: per-segment kcal/protein/
     *  sleep/rest-days/rate/rationale, capped at 3 segments (the other scoped tools' list-cap idiom).
     *  {@code prescription == null} (goal not yet activated/evaluated) renders an honest
     *  "még nincs kiértékelve" rather than nulls. */
    private String renderRecept(GoalEntity goal, ToolContext toolContext) {
        ToolContexts.audit(toolContext).addRef("Goal", goal.getTitle());
        GoalPrescriptionJson p = goal.getPrescription();
        StringBuilder b = new StringBuilder("Cél receptje: ").append(goal.getTitle());
        if (p == null || p.segments() == null || p.segments().isEmpty()) {
            return b.append(": ").append(NOT_EVALUATED).toString();
        }
        if (p.basis() != null) {
            b.append(" (").append(p.basis()).append(')');
        }
        for (GoalPrescriptionJson.Segment seg : p.segments().stream().limit(3).toList()) {
            b.append('\n').append(seg.fromWeek() != null ? seg.fromWeek() : "?")
                    .append('-').append(seg.toWeek() != null ? seg.toWeek() : "?").append(". hét: ")
                    .append(seg.kcal() != null ? seg.kcal() : "?").append(" kcal, ")
                    .append(seg.proteinG() != null ? seg.proteinG() : "?").append(" g fehérje");
            if (seg.sleepTargetH() != null) {
                b.append(", alvás ").append(ToolText.num(seg.sleepTargetH())).append(" h");
            }
            if (seg.restDays() != null && !seg.restDays().isEmpty()) {
                b.append(", pihenőnapok: ").append(seg.restDays().stream()
                        .map(String::valueOf).collect(Collectors.joining(", ")));
            }
            if (seg.projectedRateKgPerWk() != null) {
                b.append(", ütem ").append(ToolText.num(seg.projectedRateKgPerWk())).append(" kg/hét");
            }
            if (seg.rationale() != null && !seg.rationale().isBlank()) {
                b.append(" — ").append(seg.rationale());
            }
        }
        return b.toString();
    }

    /** scope=guards (mezo-xixu) — the prescription's {@code GuardStatus}: strength e1RM trend +
     *  breach, muscle weekly-set floor + below-maintenance list. Each guard renders only when
     *  {@code active} (a goal opts into strength-only/muscle-only/both/neither via {@code goal.guards}). */
    private String renderGuards(GoalEntity goal, ToolContext toolContext) {
        ToolContexts.audit(toolContext).addRef("Goal", goal.getTitle());
        GoalPrescriptionJson p = goal.getPrescription();
        GoalPrescriptionJson.GuardStatus gs = p == null ? null : p.guardStatus();
        StringBuilder b = new StringBuilder("Cél korlátai: ").append(goal.getTitle());
        if (gs == null) {
            return b.append(": ").append(NOT_EVALUATED).toString();
        }
        GoalPrescriptionJson.GuardStatus.Strength s = gs.strength();
        GoalPrescriptionJson.GuardStatus.Muscle m = gs.muscle();
        boolean any = false;
        if (s != null && Boolean.TRUE.equals(s.active())) {
            any = true;
            b.append("\nErő: e1RM trend ").append(ToolText.num(s.e1rmTrendPct())).append("%, megsértve: ")
                    .append(Boolean.TRUE.equals(s.breached()) ? "igen" : "nem");
            appendNotes(b, s.notes());
        }
        if (m != null && Boolean.TRUE.equals(m.active())) {
            any = true;
            b.append("\nIzom: heti minimum ")
                    .append(m.minWeeklySetsPerMuscle() != null ? m.minWeeklySetsPerMuscle() : "?")
                    .append(" szett/izomcsoport");
            if (m.belowMaintenanceMuscles() != null && !m.belowMaintenanceMuscles().isEmpty()) {
                b.append(", elmaradó: ").append(String.join(", ", m.belowMaintenanceMuscles()));
            }
            appendNotes(b, m.notes());
        }
        if (!any) {
            b.append(": nincs aktív korlát");
        }
        return b.toString();
    }

    private static void appendNotes(StringBuilder b, List<String> notes) {
        if (notes != null && !notes.isEmpty()) {
            b.append(" (").append(String.join("; ", notes.stream().limit(3).toList())).append(')');
        }
    }

    /** scope=feasibility (mezo-xixu) — the prescription's {@code Feasibility} verdict + notes
     *  (capped at 3), honest "még nincs kiértékelve" when the goal has no prescription yet. */
    private String renderFeasibility(GoalEntity goal, ToolContext toolContext) {
        ToolContexts.audit(toolContext).addRef("Goal", goal.getTitle());
        GoalPrescriptionJson p = goal.getPrescription();
        GoalPrescriptionJson.Feasibility f = p == null ? null : p.feasibility();
        StringBuilder b = new StringBuilder("Cél reálissága: ").append(goal.getTitle());
        if (f == null || f.verdict() == null) {
            return b.append(": ").append(NOT_EVALUATED).toString();
        }
        b.append(": ").append(f.verdict());
        if (f.notes() != null && !f.notes().isEmpty()) {
            b.append('\n').append(String.join("\n", f.notes().stream().limit(3).toList()));
        }
        return b.toString();
    }

    /** scope=timeline (mezo-xixu) — {@link GoalTimelineService#getTimeline} (pure read): the goal
     *  window's mapped plan links (mesocycle/running_block, start_week order) + the uncovered
     *  gym-lane week gaps, both capped at 3 like the other list-rendering scopes. */
    private String renderTimeline(UUID userId, GoalEntity goal, ToolContext toolContext) {
        ToolContexts.audit(toolContext).addRef("Goal", goal.getTitle());
        GoalTimelineResponse timeline = goalTimelineService.getTimeline(userId, goal.getId());
        StringBuilder b = new StringBuilder("Cél idővonala: ").append(goal.getTitle())
                .append(" (").append(timeline.getWeeks()).append(" hét)");
        if (timeline.getLinks().isEmpty()) {
            b.append("; nincs hozzárendelt terv");
        } else {
            for (GoalPlanLinkResponse link : timeline.getLinks().stream().limit(3).toList()) {
                b.append('\n').append(link.getStartWeek()).append('-').append(link.getEndWeek())
                        .append(". hét: ").append(link.getPlanType().getValue());
                if (link.getPlan() != null && link.getPlan().getTitle() != null) {
                    b.append(" — ").append(link.getPlan().getTitle());
                }
            }
        }
        if (timeline.getGaps().isEmpty()) {
            b.append("\nLefedetlen hét: nincs");
        } else {
            b.append("\nLefedetlen hetek: ").append(timeline.getGaps().stream().limit(3)
                    .map(g -> g.getFromWeek() + "-" + g.getToWeek() + ". hét")
                    .collect(Collectors.joining(", ")));
        }
        return b.toString();
    }
}

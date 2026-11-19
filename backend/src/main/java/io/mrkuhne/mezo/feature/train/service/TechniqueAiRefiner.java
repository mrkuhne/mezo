package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetLegEntity;
import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalGroupJson;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalLineJson;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetLegRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.MesoWeekProposalRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The AI refinement of a waiting weekly review (T4, {@code mezo-r36n9.82}, spec §6.5). Runs after the build's
 * transaction has committed, on its own thread, so {@code getToday} never waits on a model.
 *
 * <ol>
 *   <li>Read (own transaction): the proposal must still be {@code pending} with no technique line decided. The week
 *       the review already proposes is rebuilt from the stored rows plus its technique lines (so the planner's and
 *       the stall offers' picks are reproduced exactly), with the sets after its set lines.</li>
 *   <li>Ask the {@link TechniqueLlm} port (absent when the switch or the companion is off) with that week, the
 *       eligibility the code computed, last week's signals and logs.</li>
 *   <li>{@link TechniqueMerger} keeps only valid changes. Nothing changed → nothing written.</li>
 *   <li>Write (own transaction): re-read the proposal; still pending, no technique line decided and its technique
 *       lines the same ones we read → its technique lines are replaced by {@link TechniqueLines} on the merged week,
 *       the AI rows' lines get reason {@code ai_suggested} and the model's note, the muscles' sets-after follow.</li>
 * </ol>
 * Set lines, rep-range lines and the weight / rep previews are never touched. Every failure is logged and swallowed:
 * the planner's review simply stands.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TechniqueAiRefiner {

    private final ObjectProvider<TechniqueLlm> llm;
    private final MesoWeekProposalRepository proposalRepository;
    private final MesocycleRepository mesocycleRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final ExerciseSetRepository exerciseSetRepository;
    private final ExerciseSetLegRepository legRepository;
    private final TemplatePlan templatePlan;
    private final TechniquePlanService techniquePlanService;
    private final WeeklySignalReader signalReader;
    private final MuscleProgressReader muscleProgress;
    private final PlatformTransactionManager transactionManager;

    /** What the read step hands to the model call and the write step. */
    record Prepared(UUID proposalId, List<TemplatePlan.Row> plan, TechniquePlanner.Input input,
                    TechniquePlanner.Week week, Map<UUID, Integer> working, Set<String> techniqueLineIds,
                    TechniqueLlm.Request request) {}

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onRefineRequested(TechniqueRefineRequested event) {
        refine(event.createdBy(), event.proposalId());
    }

    /** The whole refinement for one proposal; synchronous (the listener makes it async). Never throws. */
    public void refine(UUID createdBy, UUID proposalId) {
        TechniqueLlm port = llm.getIfAvailable();
        if (port == null) {
            return;
        }
        try {
            TransactionTemplate tx = new TransactionTemplate(transactionManager);
            Prepared prep = tx.execute(status -> prepare(createdBy, proposalId));
            if (prep == null) {
                return;
            }
            Optional<TechniqueLlm.Suggestion> suggestion = port.refine(prep.request());
            if (suggestion.isEmpty()) {
                return;
            }
            TechniqueMerger.Merged merged = TechniqueMerger.merge(prep.input(), prep.week(), suggestion.get());
            if (!merged.changed()) {
                return;
            }
            tx.executeWithoutResult(status -> write(createdBy, prep, merged));
        } catch (RuntimeException e) {
            log.warn("technique AI refinement failed for proposal {} (the planner's review stands): {}", proposalId,
                e.toString());
        }
    }

    // ── read ────────────────────────────────────────────────────────────────────

    private Prepared prepare(UUID createdBy, UUID proposalId) {
        MesoWeekProposalEntity proposal = proposalRepository.findById(proposalId)
            .filter(p -> createdBy.equals(p.getCreatedBy())).orElse(null);
        if (proposal == null || !refinable(proposal)) {
            return null;
        }
        MesocycleEntity run = mesocycleRepository.findById(proposal.getMesocycleId())
            .filter(m -> createdBy.equals(m.getCreatedBy()) && !m.isDeleted()).orElse(null);
        int week = proposal.getWeek();
        if (run == null || !techniquePlanService.optsIn(run) || WeekProposalService.isDeloadPhase(run, week)) {
            return null;
        }
        List<WeekProposalLineJson> lines = proposal.getLines();
        List<TemplatePlan.Row> plan = templatePlan.rows(createdBy, run.getId());
        Map<UUID, Integer> working = new HashMap<>();
        plan.forEach(r -> working.put(r.exercise().getId(), r.exercise().getWorkingSets()));
        lines.stream().filter(l -> WeekProposalLineJson.KIND_SETS.equals(l.kind()) && l.to() != null)
            .forEach(l -> working.put(l.exerciseId(), l.to()));
        TechniquePlanner.Input input = techniquePlanService.snapshotRun(createdBy, run, week, working);
        TechniquePlanner.Week proposed = proposedWeek(input, lines);
        Set<String> techniqueLineIds = lines.stream().filter(TechniqueAiRefiner::techniqueLine)
            .map(WeekProposalLineJson::id).collect(Collectors.toSet());
        TechniqueLlm.Request request = request(createdBy, run, week, plan, input, proposed);
        return new Prepared(proposalId, plan, input, proposed, Map.copyOf(working), techniqueLineIds, request);
    }

    /** Pending, and no technique line decided yet (a decided one means he is already reviewing it). */
    private static boolean refinable(MesoWeekProposalEntity p) {
        return MesoWeekProposalEntity.STATUS_PENDING.equals(p.getStatus())
            && MesoWeekProposalEntity.KIND_WEEKLY.equals(p.getKind())
            && p.getLines() != null
            && p.getLines().stream().filter(TechniqueAiRefiner::techniqueLine).allMatch(l -> l.decision() == null);
    }

    private static boolean techniqueLine(WeekProposalLineJson l) {
        return WeekProposalLineJson.KIND_TECHNIQUE.equals(l.kind());
    }

    /**
     * The week the review proposes: each row's stored technique / challenge with its technique lines applied. A row
     * a line moves gets the line's reason and the planner as source (as the line would write it); every other pick
     * keeps its stored source (none = the owner's), so {@link TechniqueLines} on this week reproduces the lines.
     */
    static TechniquePlanner.Week proposedWeek(TechniquePlanner.Input input, List<WeekProposalLineJson> lines) {
        Map<UUID, WeekProposalLineJson> techniqueLine = new HashMap<>();
        Map<UUID, WeekProposalLineJson> challengeLine = new HashMap<>();
        for (WeekProposalLineJson l : lines) {
            if (!techniqueLine(l)) continue;
            (Boolean.TRUE.equals(l.challenge()) ? challengeLine : techniqueLine).put(l.exerciseId(), l);
        }
        List<TechniquePlanner.Pick> techniques = new ArrayList<>();
        List<TechniquePlanner.Pick> challenges = new ArrayList<>();
        for (TechniquePlanner.PlanDay day : input.days()) {
            for (TechniquePlanner.PlanRow r : day.rows()) {
                String stored = r.source() == null ? TechniquePlanner.SOURCE_OWNER : r.source();
                WeekProposalLineJson t = techniqueLine.get(r.id());
                if (t != null) {
                    Technique to = Technique.fromWire(t.toTechnique());
                    if (to != Technique.NONE) {
                        techniques.add(new TechniquePlanner.Pick(r.dayIndex(), r.exerciseIndex(), r.id(), to,
                            TechniquePlanner.SOURCE_PLANNER, firstReason(t)));
                    }
                } else if (r.technique() != null && r.technique() != Technique.NONE) {
                    techniques.add(new TechniquePlanner.Pick(r.dayIndex(), r.exerciseIndex(), r.id(), r.technique(),
                        stored, null));
                }
                WeekProposalLineJson c = challengeLine.get(r.id());
                if (c != null) {
                    if (Technique.fromWire(c.toTechnique()) == Technique.PARTIALS) {
                        challenges.add(new TechniquePlanner.Pick(r.dayIndex(), r.exerciseIndex(), r.id(),
                            Technique.PARTIALS, TechniquePlanner.SOURCE_PLANNER, firstReason(c)));
                    }
                } else if (r.challenge()) {
                    challenges.add(new TechniquePlanner.Pick(r.dayIndex(), r.exerciseIndex(), r.id(),
                        Technique.PARTIALS, stored, null));
                }
            }
        }
        return new TechniquePlanner.Week(List.copyOf(techniques), List.copyOf(challenges), List.of(), Map.of(),
            Map.of());
    }

    private static String firstReason(WeekProposalLineJson l) {
        return l.reasons() == null || l.reasons().isEmpty() ? null : l.reasons().get(0);
    }

    private TechniqueLlm.Request request(UUID createdBy, MesocycleEntity run, int week, List<TemplatePlan.Row> plan,
                                         TechniquePlanner.Input input, TechniquePlanner.Week proposed) {
        Map<UUID, TemplatePlan.Row> planById = new HashMap<>();
        plan.forEach(r -> planById.put(r.exercise().getId(), r));
        Map<UUID, Technique> plannedTechnique = new HashMap<>();
        proposed.techniques().forEach(p -> plannedTechnique.put(p.id(), p.technique()));
        Set<UUID> plannedChallenge = new HashSet<>();
        proposed.challenges().forEach(p -> plannedChallenge.add(p.id()));
        Map<String, String> lastWeek = lastWeekLogs(createdBy, run, week - 1);

        List<TechniqueLlm.DayView> days = new ArrayList<>();
        for (TechniquePlanner.PlanDay day : input.days()) {
            List<TechniqueLlm.RowView> rows = new ArrayList<>();
            String dayName = null;
            for (TechniquePlanner.PlanRow r : day.rows()) {
                TemplatePlan.Row planRow = planById.get(r.id());
                if (planRow == null) continue;   // only the counting template rows
                dayName = planRow.dayName();
                ExerciseEntity e = planRow.exercise();
                boolean eligible = week >= input.cfg().startWeek()
                    && !TechniquePlanner.owned(r) && r.group() != null
                    && PriorityTier.of(input.priorities(), r.group()) != PriorityTier.MAINTAIN
                    && TechniquePlanner.eligible(r, day, input, plannedChallenge);
                rows.add(new TechniqueLlm.RowView(r.id(), e.getName(), r.group(),
                    r.group() == null ? null : tierWire(PriorityTier.of(input.priorities(), r.group())),
                    r.workingSets(), e.getRepMin(), e.getRepMax(),
                    r.effectiveStyle() == null ? null : r.effectiveStyle().name().toLowerCase(java.util.Locale.ROOT),
                    r.technique() == null ? Technique.NONE.wire() : r.technique().wire(),
                    r.source(), r.challenge(), eligible,
                    !TechniquePlanner.owned(r) && TechniquePlanner.challengeValid(r, day, input),
                    plannedTechnique.getOrDefault(r.id(), Technique.NONE).wire(), plannedChallenge.contains(r.id()),
                    lastWeek.get(ExerciseHistoryResolver.identityKey(e))));
            }
            if (!rows.isEmpty()) {
                days.add(new TechniqueLlm.DayView(day.dayIndex(), dayName, day.sportDay(),
                    TechniquePlanner.allowance(day, input), List.copyOf(rows)));
            }
        }
        Set<String> stalled = muscleProgress.stalledGroups(createdBy, run, week - 1);
        Map<String, WeeklySignalReader.GroupSignals> signals = signalReader.read(createdBy, run, week);
        Set<String> groups = new java.util.TreeSet<>(signals.keySet());
        groups.addAll(stalled);
        List<TechniqueLlm.GroupSignal> groupSignals = groups.stream().map(g -> {
            WeeklySignalReader.GroupSignals s = signals.get(g);
            return new TechniqueLlm.GroupSignal(g, s != null && s.grind(), s != null && s.jointPain(),
                s != null && s.sorenessHigh(), stalled.contains(g));
        }).toList();
        return new TechniqueLlm.Request(week, run.getWeeks(), input.deficit(), input.cfg().maxPerMuscleWeek(),
            List.copyOf(days), groupSignals);
    }

    private static String tierWire(PriorityTier tier) {
        return switch (tier) {
            case EMPHASIZE -> "emphasize";
            case GROW -> "grow";
            case MAINTAIN -> "maintain";
        };
    }

    /**
     * Last week's logged working sets per exercise identity over the run's completed sessions of that week, e.g.
     * {@code "60×10, 60×9, 57.5×8 (cél 8–12); technika rest_drop, kiegészítő részek: 2"}. Empty for week 0.
     */
    private Map<String, String> lastWeekLogs(UUID createdBy, MesocycleEntity run, int week) {
        if (week < 1) {
            return Map.of();
        }
        List<UUID> sessionIds = workoutSessionRepository
            .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(run.getId())).stream()
            .filter(s -> s.getTemplateSessionId() != null && "completed".equals(s.getStatus()) && s.getDate() != null)
            .filter(s -> !s.getDate().isBefore(run.getStartDate())
                && MesoWeeks.weekOf(run.getStartDate(), s.getDate(), Integer.MAX_VALUE) == week)
            .map(WorkoutSessionEntity::getId).toList();
        if (sessionIds.isEmpty()) {
            return Map.of();
        }
        List<ExerciseSetEntity> sets = exerciseSetRepository.findWorkingSetsInSessions(createdBy, sessionIds);
        if (sets.isEmpty()) {
            return Map.of();
        }
        Set<UUID> exerciseIds = sets.stream().map(ExerciseSetEntity::getExerciseId).collect(Collectors.toSet());
        Map<UUID, ExerciseEntity> exercises = exerciseRepository.findOwnedByIdIncludingDeleted(createdBy, exerciseIds)
            .stream().collect(Collectors.toMap(ExerciseEntity::getId, Function.identity(), (a, b) -> a));
        Map<UUID, Long> legsBySet = legRepository.findByExerciseSetIdIn(
                sets.stream().map(ExerciseSetEntity::getId).toList()).stream()
            .collect(Collectors.groupingBy(ExerciseSetLegEntity::getExerciseSetId, Collectors.counting()));

        Map<String, List<ExerciseSetEntity>> byIdentity = new TreeMap<>();
        for (ExerciseSetEntity set : sets) {
            ExerciseEntity e = exercises.get(set.getExerciseId());
            if (e != null) {
                byIdentity.computeIfAbsent(ExerciseHistoryResolver.identityKey(e), k -> new ArrayList<>()).add(set);
            }
        }
        Map<String, String> out = new LinkedHashMap<>();
        byIdentity.forEach((key, list) -> {
            list.sort(Comparator.comparing(ExerciseSetEntity::getSetIndex,
                Comparator.nullsLast(Comparator.naturalOrder())));
            StringBuilder b = new StringBuilder();
            b.append(list.stream().map(TechniqueAiRefiner::setText).collect(Collectors.joining(", ")));
            ExerciseSetEntity first = list.get(0);
            if (first.getTargetRepMin() != null && first.getTargetRepMax() != null) {
                b.append(" (cél ").append(first.getTargetRepMin()).append('–').append(first.getTargetRepMax())
                    .append(')');
            }
            List<String> techniques = list.stream().map(ExerciseSetEntity::getTechnique).filter(Objects::nonNull)
                .distinct().toList();
            if (!techniques.isEmpty()) {
                long legs = list.stream().mapToLong(x -> legsBySet.getOrDefault(x.getId(), 0L)).sum();
                b.append("; technika ").append(String.join("/", techniques))
                    .append(", kiegészítő részek naplózva: ").append(legs);
            }
            out.put(key, b.toString());
        });
        return out;
    }

    private static String setText(ExerciseSetEntity s) {
        BigDecimal kg = s.getWeightKg();
        String w = kg == null ? "0" : kg.stripTrailingZeros().toPlainString();
        return w + "×" + s.getReps() + (s.getRir() == null ? "" : " RIR" + s.getRir());
    }

    // ── write ───────────────────────────────────────────────────────────────────

    private void write(UUID createdBy, Prepared prep, TechniqueMerger.Merged merged) {
        MesoWeekProposalEntity proposal = proposalRepository.findById(prep.proposalId())
            .filter(p -> createdBy.equals(p.getCreatedBy())).orElse(null);
        if (proposal == null || !refinable(proposal)) {
            return;
        }
        List<WeekProposalLineJson> lines = proposal.getLines();
        Set<String> nowIds = lines.stream().filter(TechniqueAiRefiner::techniqueLine).map(WeekProposalLineJson::id)
            .collect(Collectors.toSet());
        if (!nowIds.equals(prep.techniqueLineIds())) {
            return;   // the review changed since we read it
        }
        TechniqueLines.Result result = TechniqueLines.lines(prep.plan(), prep.input(), merged.week(), prep.working());
        List<WeekProposalLineJson> fresh = result.lines().stream()
            .map(l -> merged.notes().containsKey(l.exerciseId()) ? l.withAiNote(merged.notes().get(l.exerciseId())) : l)
            .toList();

        List<WeekProposalLineJson> next = new ArrayList<>();
        boolean inserted = false;
        for (WeekProposalLineJson l : lines) {
            if (techniqueLine(l)) {
                if (!inserted) {
                    next.addAll(fresh);
                    inserted = true;
                }
                continue;
            }
            if (!inserted && !WeekProposalLineJson.KIND_SETS.equals(l.kind())) {
                next.addAll(fresh);   // after the set lines, before the rep-range / load lines (as the build)
                inserted = true;
            }
            next.add(l);
        }
        if (!inserted) {
            next.addAll(fresh);
        }
        proposal.setLines(List.copyOf(next));
        proposal.setGroups(adjustGroups(proposal.getGroups(), lines, next));
        proposalRepository.save(proposal);
        log.info("technique AI refined proposal {}: {} row(s) changed", prep.proposalId(), merged.notes().size());
    }

    /** The muscles' sets-after follow the technique lines' set changes (a technique gives one straight set back). */
    private static List<WeekProposalGroupJson> adjustGroups(List<WeekProposalGroupJson> groups,
                                                            List<WeekProposalLineJson> before,
                                                            List<WeekProposalLineJson> after) {
        if (groups == null) {
            return null;
        }
        Map<String, Integer> delta = new HashMap<>();
        before.stream().filter(TechniqueAiRefiner::techniqueLine)
            .forEach(l -> delta.merge(l.muscleGroup(), -(nz(l.to()) - nz(l.from())), Integer::sum));
        after.stream().filter(TechniqueAiRefiner::techniqueLine)
            .forEach(l -> delta.merge(l.muscleGroup(), nz(l.to()) - nz(l.from()), Integer::sum));
        return groups.stream().map(g -> {
            int d = delta.getOrDefault(g.muscle(), 0);
            return d == 0 ? g : new WeekProposalGroupJson(g.muscle(), g.tier(), g.bandLow(), g.bandHigh(),
                g.sportAdjusted(), g.setsBefore(), g.setsAfter() + d, g.reasons());
        }).toList();
    }

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }
}

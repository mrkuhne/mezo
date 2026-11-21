package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoPlanGenerateRequest;
import io.mrkuhne.mezo.api.dto.MesoPlanGenerateResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.feature.train.config.MesoPlanProperties;
import io.mrkuhne.mezo.feature.train.config.TrainStyleProperties;
import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.entity.json.GymExerciseJson;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * POST /api/train/meso-plans/generate — the single Hypertrophy model of the wizard redesign.
 * Skeleton (pure) → deterministic fill (pure) → optional LLM pick through the train-owned
 * {@link MesoPlanLlm} port (absent when the AI/companion switch is off) → merge (pure) → a
 * {@code MesoTemplateUpsertRequest} the FE posts back to {@code createMesoTemplate} unchanged.
 * Nothing is persisted here. The template carries the configured default training style
 * ({@code mezo.meso-plan.default-training-style}, mezo-r36n9.115) and its exercises come back already
 * stamped by {@link StyleStamper} — the same stamp the template save applies, so posting it back is a no-op.
 */
@Service
@RequiredArgsConstructor
public class MesoPlanGeneratorService {

    static final String GOAL_PRESET = "hypertrophy";
    static final String RATIONALE_DETERMINISTIC =
        "Determinisztikus kiosztás: a split a napszámból, a szettek a MEV/MAV/MRV sávokból — bármit cserélhetsz.";

    private final ExerciseCatalogRepository catalogRepository;
    private final VolumeProperties volumeProperties;
    private final MesoPlanProperties props;
    private final TrainStyleProperties styleProps;
    private final ObjectProvider<MesoPlanLlm> llm;
    private final MesoPlanEvaluateService evaluator;

    /** No {@code @Transactional} here on purpose (mirrors {@code HabitAiService.suggest}): the
     *  slow-tier LLM round-trip below must never hold a DB connection open for its duration. The
     *  repository reads ({@link #catalogue}, the evaluator's) are transactional on their own. */
    public MesoPlanGenerateResponse generate(UUID user, MesoPlanGenerateRequest req) {
        MesoWeeksGuard.check(req.getWeeks(), consolidation(req));
        // the Hangsúly cap 400 wins over an unknown split 400 (checked again inside draft, harmlessly)
        PriorityGuard.checkEmphasizeCap(PriorityTier.normalize(req.getPriorities()), volumeProperties.bands().emphasizeMax());
        MesoPlanProperties.Split split = resolveSplit(req);
        Catalogue catalogue = catalogue(user);
        Draft draft = draft(req, split, catalogue);
        MesoPlanSkeleton.Skeleton skeleton = draft.skeleton();
        List<MesoPlanFiller.Candidate> candidates = draft.candidates();
        Map<String, String> priorities = draft.priorities();
        List<MesoPlanFiller.FilledDay> days = draft.days();

        boolean llmUsed = false;
        String rationale = RATIONALE_DETERMINISTIC;
        MesoPlanLlm port = llm.getIfAvailable();
        if (port != null) {
            Optional<MesoPlanLlm.Suggestion> s = port.propose(toRequest(skeleton, candidates, priorities, req.getGoalText()));
            if (s.isPresent()) {
                MesoPlanMerger.MergeResult merged = MesoPlanMerger.merge(skeleton, days, s.get(), candidates, props);
                // an answer that changed nothing (no accepted pick) is treated like no answer:
                // keep the deterministic days AND the deterministic rationale.
                if (merged.appliedPicks() > 0 && stillPasses(user, split, req,
                        toTemplate(skeleton, merged.days(), priorities, req, catalogue))) {
                    days = merged.days();
                    llmUsed = true;
                    if (s.get().rationale() != null && !s.get().rationale().isBlank()) {
                        rationale = s.get().rationale().strip();
                    }
                }
            }
        }
        return MesoPlanGenerateResponse.builder()
            // Stateless mint (mezo-76f6): no content hash, no persistence — a fresh id per
            // generate/regenerate call; the FE echoes it back to
            // POST /api/ai-drafts/{draftId}/outcome once the wizard resolves it.
            .draftId(UUID.randomUUID())
            .template(toTemplate(skeleton, days, priorities, req, catalogue))
            .rationale(rationale)
            .llmUsed(llmUsed)
            .build();
    }

    /**
     * The deterministic plan for one split — skeleton → fill → style stamp, never the LLM (mezo-r36n9.113): what
     * {@code generate} would return with the LLM off, for {@code split} (null = the default split). The
     * candidates endpoint evaluates one of these per catalogued split. Throws 400 above the Hangsúly cap.
     */
    MesoTemplateUpsertRequest deterministicTemplate(MesoPlanGenerateRequest req, MesoPlanProperties.Split split,
                                                    Catalogue catalogue) {
        Draft draft = draft(req, split, catalogue);
        return toTemplate(draft.skeleton(), draft.days(), draft.priorities(), req, catalogue);
    }

    /**
     * The chosen candidate's promise (mezo-r36n9.113): with a split and a session-minutes target, the LLM-merged plan
     * is kept only when it still passes the candidate filters ({@link CandidateRanker#passes}) — measured exactly as
     * the candidates endpoint measures. Without a split or a target there is nothing to keep, so it passes.
     */
    private boolean stillPasses(UUID user, MesoPlanProperties.Split split, MesoPlanGenerateRequest req,
                                MesoTemplateUpsertRequest merged) {
        if (split == null || req.getSessionMinutesTarget() == null) {
            return true;
        }
        MesoPlanEvaluateService.Measured m = evaluator.measure(user,
            MesoPlanEvaluateService.requestFor(merged, req.getSportGroups(), req.getSessionMinutesTarget()));
        return CandidateRanker.passes(new CandidateRanker.Scored(split, m.result(), req.getSessionMinutesTarget()));
    }

    /**
     * The catalogue rows the filler may pick (master + this user's own, no plyo, landmark groups only) and their
     * stability for the style stamp — one read, reused by every plan built in the request (mezo-r36n9.113).
     */
    record Catalogue(List<MesoPlanFiller.Candidate> candidates, CatalogAttributes.Lookup stability) {}

    /** Master rows + this user's own catalog rows; soft-deleted rows are already filtered by the entity. */
    Catalogue catalogue(UUID user) {
        List<MesoPlanFiller.Candidate> out = new ArrayList<>();
        Set<UUID> stable = new HashSet<>();
        for (ExerciseCatalogEntity e : catalogRepository.findAllByOrderByMuscleAscNameAsc()) {
            if (e.getCreatedBy() != null && !user.equals(e.getCreatedBy())) continue;
            if ("plyo".equals(e.getType())) continue;
            String group = MuscleGroup.of(e.getMuscle());
            if (!volumeProperties.baselines().containsKey(group)) continue;
            out.add(new MesoPlanFiller.Candidate(e.getId(), e.getName(), e.getMuscle(), group, e.getType(),
                e.getStim() == null ? 0.5 : e.getStim().doubleValue(),
                e.getFatigue() == null ? 0.5 : e.getFatigue().doubleValue()));
            if ("stable".equals(e.getStability())) stable.add(e.getId());
        }
        return new Catalogue(List.copyOf(out), new CatalogAttributes.Lookup(Set.copyOf(stable)));
    }

    /** The shared deterministic half: normalised priorities (capped), skeleton, catalogue rows, filled days. */
    private record Draft(Map<String, String> priorities, MesoPlanSkeleton.Skeleton skeleton,
                         List<MesoPlanFiller.Candidate> candidates, List<MesoPlanFiller.FilledDay> days) {}

    private Draft draft(MesoPlanGenerateRequest req, MesoPlanProperties.Split split, Catalogue catalogue) {
        Map<String, String> priorities = consolidation(req) ? allMaintain()
            : PriorityTier.normalize(req.getPriorities());
        PriorityGuard.checkEmphasizeCap(priorities, volumeProperties.bands().emphasizeMax());
        MesoPlanSkeleton.Skeleton skeleton = buildSkeleton(req, priorities, split);
        List<MesoPlanFiller.Candidate> candidates = catalogue.candidates();
        return new Draft(priorities, skeleton, candidates, MesoPlanFiller.fill(skeleton, candidates, props));
    }

    static boolean consolidation(MesoPlanGenerateRequest req) {
        return Boolean.TRUE.equals(req.getConsolidation());
    }

    /** Consolidation: every baseline group at Tartás, whatever the request said. */
    private Map<String, String> allMaintain() {
        Map<String, String> out = new LinkedHashMap<>();
        volumeProperties.baselines().keySet().forEach(g -> out.put(g, "maintain"));
        return out;
    }

    /** Null when no split is chosen; else the catalogued split of the clamped day count (400 when unknown). */
    private MesoPlanProperties.Split resolveSplit(MesoPlanGenerateRequest req) {
        if (req.getSplit() == null) {
            return null;
        }
        return SplitCatalog.find(props, dayCount(req), req.getSplit()).orElseThrow(() ->
            new SystemRuntimeErrorException(SystemMessage.error("TRAIN_MESO_SPLIT_UNKNOWN").build(), HttpStatus.BAD_REQUEST));
    }

    private static int dayCount(MesoPlanGenerateRequest req) {
        return Math.max(2, Math.min(6, req.getDaysOfWeek().size()));
    }

    /** Default split (today's {@code SPLIT_DAYS}) when {@code split} is null; else that catalogued split. */
    private MesoPlanSkeleton.Skeleton buildSkeleton(MesoPlanGenerateRequest req, Map<String, String> priorities,
                                                    MesoPlanProperties.Split split) {
        List<String> days = List.copyOf(req.getDaysOfWeek());
        MesoPlanSkeleton.Skeleton s = split == null
            ? MesoPlanSkeleton.build(days, req.getWeeks(), priorities, volumeProperties.baselines(),
                volumeProperties.bands())
            : MesoPlanSkeleton.build(days, req.getWeeks(), priorities, volumeProperties.baselines(),
                volumeProperties.bands(), split.types(), split.label());
        if (!consolidation(req)) {
            return s;
        }
        return new MesoPlanSkeleton.Skeleton(s.splitLabel(), s.days(), s.weekOneSets(),
            MesoPlanSkeleton.flatCurve(req.getWeeks()));
    }

    private static MesoPlanLlm.Request toRequest(MesoPlanSkeleton.Skeleton s, List<MesoPlanFiller.Candidate> candidates,
                                                 Map<String, String> priorities, String goalText) {
        List<MesoPlanLlm.FramedDay> framed = s.days().stream()
            .filter(d -> !d.muscles().isEmpty())
            .map(d -> {
                Map<String, Integer> by = new LinkedHashMap<>();
                d.muscles().forEach(m -> by.put(m.group(), m.sets()));
                return new MesoPlanLlm.FramedDay(d.day(), d.type(), by);
            }).toList();
        return new MesoPlanLlm.Request(framed, candidates, priorities, goalText == null ? "" : goalText.strip());
    }

    private MesoTemplateUpsertRequest toTemplate(MesoPlanSkeleton.Skeleton s, List<MesoPlanFiller.FilledDay> days,
                                                 Map<String, String> priorities, MesoPlanGenerateRequest req,
                                                 Catalogue catalogue) {
        List<MesoDayInput> dayInputs = new ArrayList<>(7);
        for (int i = 0; i < s.days().size(); i++) {
            MesoPlanSkeleton.DayFrame frame = s.days().get(i);
            MesoPlanFiller.FilledDay filled = days.get(i);
            if ("Rest".equals(frame.type())) {
                dayInputs.add(MesoDayInput.builder().day(frame.day()).type("Rest").muscle("").note("Pihenőnap").exercises(List.of()).build());
                continue;
            }
            String accent = frame.muscles().isEmpty() ? "" : frame.muscles().get(0).group();
            List<GymExerciseInput> exercises = filled.picks().stream().map(this::toExercise).toList();
            // after the LLM merge (days are the merged ones here): a re-pick cannot reintroduce warm-ups
            WarmupRule.apply(exercises, props.compoundWarmup(), props.isolationWarmup());
            dayInputs.add(MesoDayInput.builder().day(frame.day()).type(frame.type()).muscle(accent)
                .exercises(exercises).build());
        }
        TrainingStyle style = TrainingStyle.fromWire(props.defaultTrainingStyleOrNull());
        if (style != null) {
            dayInputs = stamp(dayInputs, style, catalogue.stability());
        }
        boolean consolidation = consolidation(req);
        String title = consolidation ? "Lezárás" : "Hypertrophy · " + season(LocalDate.now());
        return MesoTemplateUpsertRequest.builder()
            .title(title).shortTitle(consolidation ? "Lezárás" : "Hypertrophy").goal("Izomtömeg építés").goalPreset(GOAL_PRESET)
            .musclePriorities(priorities.isEmpty() ? null : priorities)
            .weeks(req.getWeeks()).split(s.splitLabel()).style((consolidation ? "Lezárás" : "RP") + " · " + req.getWeeks() + " hét")
            .phaseCurve(s.phaseCurve().stream().map(MesoTemplateUpsertRequest.PhaseCurveEnum::fromValue).toList())
            .notes(req.getGoalText() == null || req.getGoalText().isBlank() ? null : req.getGoalText().strip())
            .volumePerMuscle(null) // volume engine v2: landmarks are never stored in a template
            .days(dayInputs)
            .trainingStyle(style == null ? null : io.mrkuhne.mezo.api.dto.TrainingStyle.fromValue(style.wire()))
            .build();
    }

    /**
     * Stamps every generated exercise under the block style through {@link StyleStamper} (rep range,
     * reserve, rest; working sets only where the style row fixes them), with the catalog stability read
     * once per request ({@link Catalogue}). Techniques stay off: nothing here sets one.
     */
    private List<MesoDayInput> stamp(List<MesoDayInput> days, TrainingStyle style, CatalogAttributes.Lookup stability) {
        return days.stream().map(d -> {
            d.setExercises(d.getExercises().stream().map(e -> {
                GymExerciseJson stamped = StyleStamper.stamp(new GymExerciseJson(null, e.getName(), e.getMuscle(),
                    e.getWarmupSets(), e.getWorkingSets(), e.getRepMin(), e.getRepMax(), e.getTargetRIR(), null,
                    e.getType().getValue(), null, e.getCatalogId(), e.getCountsTowardVolume(), null, null, null,
                    null, null, null), style, stability.stable(e.getCatalogId()), styleProps);
                e.setWorkingSets(stamped.workingSets());
                e.setRepMin(stamped.repMin());
                e.setRepMax(stamped.repMax());
                e.setTargetRIR(stamped.targetRir());
                e.setRestSec(stamped.restSec());
                return e;
            }).toList());
            return d;
        }).toList();
    }

    private GymExerciseInput toExercise(MesoPlanFiller.Pick p) {
        boolean compound = "compound".equals(p.candidate().type());
        return GymExerciseInput.builder()
            .name(p.candidate().name()).muscle(p.candidate().muscle()).catalogId(p.candidate().id())
            .warmupSets(compound ? props.compoundWarmup() : props.isolationWarmup())
            .workingSets(Math.max(1, Math.min(10, p.workingSets())))
            .repMin(compound ? props.compoundRepMin() : props.isolationRepMin())
            .repMax(compound ? props.compoundRepMax() : props.isolationRepMax())
            .targetRIR(props.targetRir())
            .type(GymExerciseInput.TypeEnum.fromValue(p.candidate().type()))
            .countsTowardVolume(true)
            .build();
    }

    static String season(LocalDate d) {
        return switch (d.getMonthValue()) {
            case 12, 1, 2 -> "Tél";
            case 3, 4, 5 -> "Tavasz";
            case 6, 7, 8 -> "Nyár";
            default -> "Ősz";
        };
    }
}

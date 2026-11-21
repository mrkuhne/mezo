package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.CandidateFix;
import io.mrkuhne.mezo.api.dto.CandidateReason;
import io.mrkuhne.mezo.api.dto.IntakeBudget;
import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoPlanCandidate;
import io.mrkuhne.mezo.api.dto.MesoPlanCandidates;
import io.mrkuhne.mezo.api.dto.MesoPlanCandidatesRequest;
import io.mrkuhne.mezo.api.dto.MesoPlanGenerateRequest;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.feature.train.config.MesoPlanProperties;
import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.TreeMap;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code POST /api/train/meso-plans/candidates} (mezo-r36n9.113, spec §5 S1.2): one deterministic plan per
 * catalogued split of the chosen day count (skeleton → fill → style stamp, never the LLM), each measured exactly as
 * {@code POST /meso-plans/evaluate} would measure it, then filtered and ranked by {@link CandidateRanker}. Nothing
 * is persisted. When nothing fits and a Hangsúly is set, the plans are rebuilt once with the most-loaded
 * Hangsúly lowered to Építés; {@code fewer_emphasis} (naming that muscle) is offered only if that rebuild yields a
 * candidate. The response's {@code intakeBudget} is week-1 based (consistent with the filter): the lead candidate's
 * sets against what its days fit, and per muscle whether raising only it one tier still offers a candidate. The
 * catalogue, the sport slots and the deficit are read once per request and reused by every rebuild.
 */
@Service
@RequiredArgsConstructor
public class MesoPlanCandidatesService {

    private static final String EMPHASIZE = "emphasize";
    private static final String GROW = "grow";
    private static final String MAINTAIN = "maintain";

    private final MesoPlanGeneratorService generator;
    private final MesoPlanEvaluateService evaluator;
    private final MesoPlanProperties props;
    private final VolumeProperties volumeProperties;

    /** One built candidate: its template, its evaluation and the ranker's view of it. */
    private record Built(MesoTemplateUpsertRequest template, MesoPlanEvaluateService.Measured measured,
                         CandidateRanker.Scored scored) {}

    /** The request's reads, done once: the catalogue and the owner's evaluator context. */
    private record Shared(MesoPlanGeneratorService.Catalogue catalogue, MesoPlanEvaluateService.Context context) {}

    @Transactional(readOnly = true)
    public MesoPlanCandidates candidates(UUID user, MesoPlanCandidatesRequest req) {
        boolean consolidation = Boolean.TRUE.equals(req.getConsolidation());
        MesoWeeksGuard.check(req.getWeeks(), consolidation);
        Map<String, String> priorities = consolidation ? allMaintain() : PriorityTier.normalize(req.getPriorities());
        PriorityGuard.checkEmphasizeCap(priorities, volumeProperties.bands().emphasizeMax());
        Shared shared = new Shared(generator.catalogue(user), evaluator.context(user));

        List<Built> built = build(user, req, priorities, shared);
        CandidateRanker.Ranked ranked = CandidateRanker.rank(built.stream().map(Built::scored).toList());
        List<CandidateRanker.Fix> fixes = new ArrayList<>(ranked.fixes());
        if (ranked.nothingFits() && !ranked.offered().isEmpty()) {
            fewerEmphasis(user, req, priorities, ranked.offered().get(0), shared).ifPresent(muscle -> {
                int at = fixes.isEmpty() || !CandidateRanker.FIX_MORE_MINUTES.equals(fixes.get(0).code()) ? 0 : 1;
                fixes.add(at, new CandidateRanker.Fix(CandidateRanker.FIX_FEWER_EMPHASIS, null, muscle));
            });
        }

        CandidateRanker.Scored recommended = ranked.offered().isEmpty() ? null : ranked.offered().get(0);
        List<MesoPlanCandidate> out = new ArrayList<>();
        for (CandidateRanker.Scored s : ranked.offered()) {
            Built b = find(built, s);
            out.add(MesoPlanCandidate.builder()
                .splitKey(s.split().key()).splitLabel(s.split().label())
                .template(b.template()).evaluation(b.measured().evaluation())
                .recommended(!ranked.nothingFits() && s == recommended)
                .reasons(CandidateRanker.reasons(s, recommended).stream().map(r -> CandidateReason.builder()
                    .code(CandidateReason.CodeEnum.fromValue(r.code())).value(r.value()).build()).toList())
                .build());
        }
        return MesoPlanCandidates.builder()
            .candidates(out)
            .nothingFits(ranked.nothingFits())
            .fixes(fixes.stream().map(f -> CandidateFix.builder()
                .code(CandidateFix.CodeEnum.fromValue(f.code())).value(f.value()).muscle(f.muscle()).build()).toList())
            .intakeBudget(recommended == null ? null
                : intakeBudget(user, req, priorities, find(built, recommended), shared))
            .build();
    }

    /** Consolidation: every baseline group at Tartás, whatever the request said. */
    private Map<String, String> allMaintain() {
        Map<String, String> out = new LinkedHashMap<>();
        volumeProperties.baselines().keySet().forEach(g -> out.put(g, MAINTAIN));
        return out;
    }

    private static Built find(List<Built> built, CandidateRanker.Scored s) {
        return built.stream().filter(x -> x.scored() == s).findFirst().orElseThrow();
    }

    private List<Built> build(UUID user, MesoPlanCandidatesRequest req, Map<String, String> priorities, Shared shared) {
        MesoPlanGenerateRequest gen = MesoPlanGenerateRequest.builder()
            .daysOfWeek(req.getDaysOfWeek()).weeks(req.getWeeks()).consolidation(req.getConsolidation())
            .priorities(priorities.isEmpty() ? null : priorities).build();
        List<Built> out = new ArrayList<>();
        for (MesoPlanProperties.Split split : SplitCatalog.forDays(props, req.getDaysOfWeek().size())) {
            MesoTemplateUpsertRequest t = generator.deterministicTemplate(gen, split, shared.catalogue());
            MesoPlanEvaluateService.Measured m = evaluator.measure(user, MesoPlanEvaluateService.requestFor(t,
                req.getSportGroups(), req.getSessionMinutesTarget()), shared.context());
            out.add(new Built(t, m, new CandidateRanker.Scored(split, m.result(), req.getSessionMinutesTarget(),
                warmupsPerWeek(t))));
        }
        return out;
    }

    /** True when the plans rebuilt under {@code priorities} offer at least one candidate. */
    private boolean offers(UUID user, MesoPlanCandidatesRequest req, Map<String, String> priorities, Shared shared) {
        List<CandidateRanker.Scored> rescored = build(user, req, PriorityTier.normalize(priorities), shared).stream()
            .map(Built::scored).toList();
        return !CandidateRanker.rank(rescored).nothingFits();
    }

    /**
     * Lowers the Hangsúly muscle with the most weekly sets in the closest candidate to Építés and rebuilds; that
     * muscle when the rebuild offers at least one candidate. Empty without any Hangsúly.
     */
    private Optional<String> fewerEmphasis(UUID user, MesoPlanCandidatesRequest req, Map<String, String> priorities,
                                           CandidateRanker.Scored closest, Shared shared) {
        if (!priorities.containsValue(EMPHASIZE)) {
            return Optional.empty();
        }
        String lowered = closest.eval().muscles().stream()
            .filter(m -> m.tier() == PriorityTier.EMPHASIZE)
            .max(Comparator.comparingInt(PlanEvaluator.MuscleResult::weeklySets))
            .map(PlanEvaluator.MuscleResult::muscle)
            .orElseGet(() -> priorities.entrySet().stream().filter(e -> EMPHASIZE.equals(e.getValue()))
                .map(Map.Entry::getKey).findFirst().orElseThrow());
        Map<String, String> fewer = new LinkedHashMap<>(priorities);
        fewer.put(lowered, GROW);
        return offers(user, req, fewer, shared) ? Optional.of(lowered) : Optional.empty();
    }

    /**
     * The intake's week-1 budget for the lead candidate: its counting sets, what its training days fit
     * ({@link TierBudget#intakeCapacity}), and — with a target only — per landmark muscle not at Hangsúly whether
     * raising only it one tier (within the Hangsúly cap) still offers a candidate.
     */
    private IntakeBudget intakeBudget(UUID user, MesoPlanCandidatesRequest req, Map<String, String> priorities,
                                      Built lead, Shared shared) {
        int emphasizeMax = volumeProperties.bands().emphasizeMax();
        int emphasized = (int) priorities.values().stream().filter(EMPHASIZE::equals).count();
        Map<String, Boolean> raiseAllowed = new TreeMap<>();
        if (req.getSessionMinutesTarget() != null) {
            for (String muscle : volumeProperties.baselines().keySet()) {
                String tier = priorities.getOrDefault(muscle, GROW);
                if (EMPHASIZE.equals(tier)) continue;
                String raised = MAINTAIN.equals(tier) ? GROW : EMPHASIZE;
                if (EMPHASIZE.equals(raised) && emphasized >= emphasizeMax) {
                    raiseAllowed.put(muscle, false);
                    continue;
                }
                Map<String, String> what = new LinkedHashMap<>(priorities);
                what.put(muscle, raised);
                raiseAllowed.put(muscle, offers(user, req, what, shared));
            }
        }
        return IntakeBudget.builder()
            .usedSets(TierBudget.weekOneSets(lead.measured().result()))
            .capacitySets(TierBudget.intakeCapacity(lead.measured().input(), lead.measured().result()))
            .emphasizeCount(emphasized)
            .emphasizeMax(emphasizeMax)
            .raiseAllowed(raiseAllowed)
            .build();
    }

    private static int warmupsPerWeek(MesoTemplateUpsertRequest t) {
        return t.getDays().stream()
            .map(MesoDayInput::getExercises).filter(Objects::nonNull).flatMap(List::stream)
            .map(GymExerciseInput::getWarmupSets).filter(Objects::nonNull).mapToInt(Integer::intValue).sum();
    }
}

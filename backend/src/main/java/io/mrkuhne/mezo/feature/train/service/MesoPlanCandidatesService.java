package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.CandidateFix;
import io.mrkuhne.mezo.api.dto.CandidateReason;
import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoPlanCandidate;
import io.mrkuhne.mezo.api.dto.MesoPlanCandidates;
import io.mrkuhne.mezo.api.dto.MesoPlanCandidatesRequest;
import io.mrkuhne.mezo.api.dto.MesoPlanEvaluateRequest;
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
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code POST /api/train/meso-plans/candidates} (mezo-r36n9.113, spec §5 S1.2): one deterministic plan per
 * catalogued split of the chosen day count (skeleton → fill → style stamp, never the LLM), each measured exactly as
 * {@code POST /meso-plans/evaluate} would measure it, then filtered and ranked by {@link CandidateRanker}. Nothing
 * is persisted. When nothing fits and a Hangsúly is set, the plans are rebuilt once with the most-loaded
 * Hangsúly lowered to Építés; {@code fewer_emphasis} is offered only if that rebuild yields a candidate.
 */
@Service
@RequiredArgsConstructor
public class MesoPlanCandidatesService {

    private static final String EMPHASIZE = "emphasize";
    private static final String GROW = "grow";

    private final MesoPlanGeneratorService generator;
    private final MesoPlanEvaluateService evaluator;
    private final MesoPlanProperties props;
    private final VolumeProperties volumeProperties;

    /** One built candidate: its template, its evaluation and the ranker's view of it. */
    private record Built(MesoTemplateUpsertRequest template, MesoPlanEvaluateService.Measured measured,
                         CandidateRanker.Scored scored) {}

    @Transactional(readOnly = true)
    public MesoPlanCandidates candidates(UUID user, MesoPlanCandidatesRequest req) {
        Map<String, String> priorities = PriorityTier.normalize(req.getPriorities());
        PriorityGuard.checkEmphasizeCap(priorities, volumeProperties.bands().emphasizeMax());

        List<Built> built = build(user, req, priorities);
        CandidateRanker.Ranked ranked = CandidateRanker.rank(built.stream().map(Built::scored).toList());
        List<CandidateRanker.Fix> fixes = new ArrayList<>(ranked.fixes());
        if (ranked.nothingFits() && !ranked.offered().isEmpty() && fewerEmphasisFits(user, req, priorities,
                ranked.offered().get(0))) {
            int at = fixes.isEmpty() || !CandidateRanker.FIX_MORE_MINUTES.equals(fixes.get(0).code()) ? 0 : 1;
            fixes.add(at, new CandidateRanker.Fix(CandidateRanker.FIX_FEWER_EMPHASIS, null));
        }

        CandidateRanker.Scored recommended = ranked.offered().isEmpty() ? null : ranked.offered().get(0);
        List<MesoPlanCandidate> out = new ArrayList<>();
        for (CandidateRanker.Scored s : ranked.offered()) {
            Built b = built.stream().filter(x -> x.scored() == s).findFirst().orElseThrow();
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
                .code(CandidateFix.CodeEnum.fromValue(f.code())).value(f.value()).build()).toList())
            .build();
    }

    private List<Built> build(UUID user, MesoPlanCandidatesRequest req, Map<String, String> priorities) {
        MesoPlanGenerateRequest gen = MesoPlanGenerateRequest.builder()
            .daysOfWeek(req.getDaysOfWeek()).weeks(req.getWeeks())
            .priorities(priorities.isEmpty() ? null : priorities).build();
        List<Built> out = new ArrayList<>();
        for (MesoPlanProperties.Split split : SplitCatalog.forDays(props, req.getDaysOfWeek().size())) {
            MesoTemplateUpsertRequest t = generator.deterministicTemplate(user, gen, split);
            MesoPlanEvaluateService.Measured m = evaluator.measure(user, evaluateRequest(t, req));
            out.add(new Built(t, m, new CandidateRanker.Scored(split, m.result(), req.getSessionMinutesTarget(),
                warmupsPerWeek(t))));
        }
        return out;
    }

    /**
     * Lowers the Hangsúly muscle with the most weekly sets in the closest candidate to Építés and rebuilds; true
     * when that rebuild offers at least one candidate. False without any Hangsúly.
     */
    private boolean fewerEmphasisFits(UUID user, MesoPlanCandidatesRequest req, Map<String, String> priorities,
                                      CandidateRanker.Scored closest) {
        if (!priorities.containsValue(EMPHASIZE)) {
            return false;
        }
        String lowered = closest.eval().muscles().stream()
            .filter(m -> m.tier() == PriorityTier.EMPHASIZE)
            .max(Comparator.comparingInt(PlanEvaluator.MuscleResult::weeklySets))
            .map(PlanEvaluator.MuscleResult::muscle)
            .orElseGet(() -> priorities.entrySet().stream().filter(e -> EMPHASIZE.equals(e.getValue()))
                .map(Map.Entry::getKey).findFirst().orElseThrow());
        Map<String, String> fewer = new LinkedHashMap<>(priorities);
        fewer.put(lowered, GROW);
        List<CandidateRanker.Scored> rescored = build(user, req, PriorityTier.normalize(fewer)).stream()
            .map(Built::scored).toList();
        return !CandidateRanker.rank(rescored).nothingFits();
    }

    /** The template in the evaluate request's shape, so the evaluation is what POST /evaluate returns for it. */
    private static MesoPlanEvaluateRequest evaluateRequest(MesoTemplateUpsertRequest t, MesoPlanCandidatesRequest req) {
        return MesoPlanEvaluateRequest.builder()
            .weeks(t.getWeeks())
            .phaseCurve(t.getPhaseCurve().stream()
                .map(c -> MesoPlanEvaluateRequest.PhaseCurveEnum.fromValue(c.getValue())).toList())
            .days(t.getDays())
            .musclePriorities(t.getMusclePriorities())
            .trainingStyle(t.getTrainingStyle())
            .techniquesEnabled(t.getTechniquesEnabled())
            .sportGroups(req.getSportGroups())
            .sessionMinutesTarget(req.getSessionMinutesTarget())
            .build();
    }

    private static int warmupsPerWeek(MesoTemplateUpsertRequest t) {
        return t.getDays().stream()
            .map(MesoDayInput::getExercises).filter(Objects::nonNull).flatMap(List::stream)
            .map(GymExerciseInput::getWarmupSets).filter(Objects::nonNull).mapToInt(Integer::intValue).sum();
    }
}

package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoPlanEvaluateRequest;
import io.mrkuhne.mezo.api.dto.MesoPlanGenerateRequest;
import io.mrkuhne.mezo.api.dto.MesoPlanGenerateResponse;
import io.mrkuhne.mezo.feature.train.service.MesoPlanEvaluateService;
import io.mrkuhne.mezo.feature.train.service.MesoPlanFiller;
import io.mrkuhne.mezo.feature.train.service.MesoPlanLlm;
import io.mrkuhne.mezo.feature.train.service.PlanEvaluator;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * POST /meso-plans/generate keeps the chosen candidate's minutes (mezo-r36n9.113): with a split and a
 * session-minutes target, an LLM-merged plan that no longer passes the candidate filters falls back to the
 * deterministic plan (its rationale, llmUsed=false).
 *
 * <p>With today's compound-first filler an LLM pick can never make a day longer than the deterministic one (same
 * sets per frame, at most as many exercises, a compound wherever one exists), so the over-time pick is forced: the
 * fake LLM picks the least stimulating isolations (a plan the deterministic filler never builds), and the spied
 * evaluator reports that plan — and only that plan — one minute over the target.
 */
class MesoPlanGenerateFallbackIT extends ApiIntegrationTest {

    private static final String GENERATE = "/api/train/meso-plans/generate";
    private static final Set<String> DAYS = Set.of("Hét", "Kedd", "Csü", "Pén");
    private static final String RATIONALE = "Könnyű, izolált gyakorlatok minden napra.";

    @MockitoBean MesoPlanLlm llm;
    @MockitoSpyBean MesoPlanEvaluateService evaluator;

    /** Catalogue ids of the deterministic plan; a measured plan with any other id is the LLM's. */
    private final AtomicReference<Set<UUID>> deterministicIds = new AtomicReference<>(Set.of());
    private final AtomicBoolean overTime = new AtomicBoolean();

    private static Optional<MesoPlanLlm.Suggestion> lightPicks(MesoPlanLlm.Request req) {
        List<MesoPlanLlm.DayPick> days = new ArrayList<>();
        for (MesoPlanLlm.FramedDay d : req.days()) {
            List<MesoPlanLlm.ExercisePick> picks = new ArrayList<>();
            for (String group : d.setsByGroup().keySet()) {
                req.candidates().stream().filter(c -> c.group().equals(group))
                    .sorted(Comparator.comparing((MesoPlanFiller.Candidate c) -> "compound".equals(c.type()))
                        .thenComparingDouble(MesoPlanFiller.Candidate::stim))
                    .limit(2).forEach(c -> picks.add(new MesoPlanLlm.ExercisePick(c.id(), null)));
            }
            days.add(new MesoPlanLlm.DayPick(d.day(), picks));
        }
        return Optional.of(new MesoPlanLlm.Suggestion(RATIONALE, days));
    }

    private static Set<UUID> ids(List<io.mrkuhne.mezo.api.dto.MesoDayInput> days) {
        Set<UUID> out = new HashSet<>();
        days.stream().filter(d -> d.getExercises() != null).flatMap(d -> d.getExercises().stream())
            .map(GymExerciseInput::getCatalogId).filter(Objects::nonNull).forEach(out::add);
        return out;
    }

    @BeforeEach
    void forceOverTime() {
        doAnswer(inv -> {
            MesoPlanEvaluateService.Measured real = (MesoPlanEvaluateService.Measured) inv.callRealMethod();
            MesoPlanEvaluateRequest req = inv.getArgument(1);
            if (!overTime.get() || req.getSessionMinutesTarget() == null
                    || deterministicIds.get().containsAll(ids(req.getDays()))) {
                return real;
            }
            int over = req.getSessionMinutesTarget() + 1;
            PlanEvaluator.Result r = real.result();
            List<PlanEvaluator.DayResult> days = r.days().stream().map(d -> d.minutesEstimate() == 0 ? d
                : new PlanEvaluator.DayResult(d.dayIndex(), d.day(), over, true, d.sessionCapWarnings(),
                    d.exerciseCapWarnings(), d.sportSameDay())).toList();
            return new MesoPlanEvaluateService.Measured(real.input(),
                new PlanEvaluator.Result(r.muscles(), days, r.path()), real.evaluation());
        }).when(evaluator).measure(any(), any());
    }

    private MesoPlanGenerateResponse generate(Integer target) {
        return postForBody(GENERATE, MesoPlanGenerateRequest.builder().daysOfWeek(DAYS).weeks(6).split("ul2")
            .sessionMinutesTarget(target).build(), ownerAuthHeaders(), HttpStatus.OK, MesoPlanGenerateResponse.class);
    }

    @Test
    void overTimeLlmPickFallsBackToTheDeterministicPlan() {
        when(llm.propose(any())).thenReturn(Optional.empty());
        MesoPlanGenerateResponse deterministic = generate(120);
        assertThat(deterministic.getLlmUsed()).isFalse();
        deterministicIds.set(ids(deterministic.getTemplate().getDays()));

        when(llm.propose(any())).thenAnswer(inv -> lightPicks(inv.getArgument(0)));
        MesoPlanGenerateResponse llmPlan = generate(120);   // fits: the pick stands
        assertThat(llmPlan.getLlmUsed()).isTrue();
        assertThat(llmPlan.getRationale()).isEqualTo(RATIONALE);
        assertThat(ids(llmPlan.getTemplate().getDays())).isNotEqualTo(deterministicIds.get());

        overTime.set(true);   // the LLM's plan now measures over the target
        MesoPlanGenerateResponse kept = generate(120);
        assertThat(kept.getLlmUsed()).isFalse();
        assertThat(kept.getRationale()).isEqualTo(deterministic.getRationale()).isNotEqualTo(RATIONALE);
        assertThat(kept.getTemplate().getDays()).usingRecursiveComparison()
            .isEqualTo(deterministic.getTemplate().getDays());

        // without a target there is no promise to keep: the LLM's plan stands
        MesoPlanGenerateResponse untimed = generate(null);
        assertThat(untimed.getLlmUsed()).isTrue();
    }
}

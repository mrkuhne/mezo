package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import io.mrkuhne.mezo.api.dto.CandidateFix;
import io.mrkuhne.mezo.api.dto.DayEvaluation;
import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.IntakeBudget;
import io.mrkuhne.mezo.api.dto.MesoPlanCandidate;
import io.mrkuhne.mezo.api.dto.MesoPlanCandidates;
import io.mrkuhne.mezo.api.dto.MesoPlanCandidatesRequest;
import io.mrkuhne.mezo.api.dto.MesoPlanEvaluateRequest;
import io.mrkuhne.mezo.api.dto.MesoPlanEvaluation;
import io.mrkuhne.mezo.api.dto.MesoPlanGenerateRequest;
import io.mrkuhne.mezo.api.dto.MesoPlanGenerateResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.feature.train.service.MesoPlanLlm;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** POST /api/train/meso-plans/candidates — ranked, flawless split candidates; deterministic, never the LLM. */
class MesoPlanCandidatesContractIT extends ApiIntegrationTest {

    private static final String CANDIDATES = "/api/train/meso-plans/candidates";

    @MockitoBean MesoPlanLlm llm;

    private MesoPlanCandidates candidates(MesoPlanCandidatesRequest req) {
        return postForBody(CANDIDATES, req, ownerAuthHeaders(), HttpStatus.OK, MesoPlanCandidates.class);
    }

    private static void assertWellFormed(MesoPlanCandidates res) {
        assertThat(res.getFixes()).isNotNull();
        if (Boolean.TRUE.equals(res.getNothingFits())) {
            assertThat(res.getCandidates()).hasSize(1);
            assertThat(res.getCandidates().get(0).getRecommended()).isFalse();
        } else {
            assertThat(res.getCandidates()).hasSizeBetween(1, 3);
            assertThat(res.getFixes()).isEmpty();
            List<Boolean> rec = res.getCandidates().stream().map(MesoPlanCandidate::getRecommended).toList();
            assertThat(rec.get(0)).isTrue();
            assertThat(rec.subList(1, rec.size())).allMatch(Boolean.FALSE::equals);
        }
    }

    /**
     * The plan's brief named 60 minutes; under minutes model v2 the default all-Építés Felső / Alsó plan's upper day
     * is ~77 min and Teljes test ×4's longest ~87, so at 80 only Felső / Alsó fits (60 → see the nothing-fits case).
     */
    @Test
    void fourDaysEightyMinutesOffersUl2Recommended() {
        HttpHeaders auth = ownerAuthHeaders();
        MesoPlanCandidates res = candidates(MesoPlanCandidatesRequest.builder()
            .daysOfWeek(Set.of("Hét", "Kedd", "Csü", "Pén")).weeks(6).sessionMinutesTarget(80).build());

        assertWellFormed(res);
        assertThat(res.getNothingFits()).isFalse();
        MesoPlanCandidate first = res.getCandidates().get(0);
        assertThat(first.getSplitKey()).isEqualTo("ul2");
        assertThat(first.getSplitLabel()).isEqualTo("Felső / Alsó");
        assertThat(first.getRecommended()).isTrue();
        assertThat(first.getTemplate().getSplit()).isEqualTo("Felső / Alsó · 4×/hét");
        assertThat(first.getReasons()).isNotEmpty();
        assertThat(res.getCandidates()).allSatisfy(c -> assertThat(c.getEvaluation().getDays())
            .allSatisfy(d -> assertThat(d.getOverTarget()).as(c.getSplitKey() + " " + d.getDay()).isFalse()));

        // a candidate's evaluation is exactly what POST /evaluate returns for its template
        MesoTemplateUpsertRequest t = first.getTemplate();
        MesoPlanEvaluation direct = postForBody("/api/train/meso-plans/evaluate", MesoPlanEvaluateRequest.builder()
            .weeks(t.getWeeks())
            .phaseCurve(t.getPhaseCurve().stream()
                .map(c -> MesoPlanEvaluateRequest.PhaseCurveEnum.fromValue(c.getValue())).toList())
            .days(t.getDays()).musclePriorities(t.getMusclePriorities()).trainingStyle(t.getTrainingStyle())
            .sessionMinutesTarget(80).build(), auth, HttpStatus.OK, MesoPlanEvaluation.class);
        assertThat(first.getEvaluation()).usingRecursiveComparison().isEqualTo(direct);
        assertThat(first.getEvaluation().getDays()).extracting(DayEvaluation::getMinutesEstimate)
            .allSatisfy(m -> assertThat(m).isLessThanOrEqualTo(80));
    }

    @Test
    void fourDaysSixtyMinutesNothingFitsNamesTheMinutes() {
        MesoPlanCandidates res = candidates(MesoPlanCandidatesRequest.builder()
            .daysOfWeek(Set.of("Hét", "Kedd", "Csü", "Pén")).weeks(6).sessionMinutesTarget(60).build());

        assertWellFormed(res);
        assertThat(res.getNothingFits()).isTrue();
        assertThat(res.getCandidates().get(0).getSplitKey()).isEqualTo("ul2");   // smallest overrun
        assertThat(res.getFixes()).extracting(CandidateFix::getCode)
            .containsExactly(CandidateFix.CodeEnum.MORE_MINUTES, CandidateFix.CodeEnum.MORE_DAYS);
    }

    @Test
    void fewerEmphasisOfferedWhenLoweringOneMakesItFit() {
        // back + chest Hangsúly put the upper day at ~96 min; back (the most sets) lowered → ~87, so 90 fits again
        MesoPlanCandidates res = candidates(MesoPlanCandidatesRequest.builder()
            .daysOfWeek(Set.of("Hét", "Kedd", "Csü", "Pén")).weeks(6).sessionMinutesTarget(90)
            .priorities(Map.of("back", "emphasize", "chest", "emphasize")).build());

        assertWellFormed(res);
        assertThat(res.getNothingFits()).isTrue();
        assertThat(res.getFixes()).extracting(CandidateFix::getCode).containsExactly(CandidateFix.CodeEnum.MORE_MINUTES,
            CandidateFix.CodeEnum.FEWER_EMPHASIS, CandidateFix.CodeEnum.MORE_DAYS);
        // the fix names the muscle it lowers (the Hangsúly with the most sets); the others carry none
        assertThat(res.getFixes()).extracting(CandidateFix::getMuscle).containsExactly(null, "back", null);
    }

    /** The intake budget is week-1 based and consistent with the filter: an offered lead always fits its capacity. */
    @Test
    void intakeBudgetUsedNeverAboveCapacityForAnOfferedLead() {
        record Ask(Set<String> days, int minutes) {}
        List<Ask> asks = List.of(new Ask(Set.of("Hét", "Sze", "Pén"), 75), new Ask(Set.of("Hét", "Kedd", "Csü", "Pén"), 80),
            new Ask(Set.of("Hét", "Kedd", "Csü", "Pén"), 90), new Ask(Set.of("Hét", "Kedd", "Sze", "Csü", "Pén"), 60));
        for (Ask ask : asks) {
            MesoPlanCandidates res = candidates(MesoPlanCandidatesRequest.builder()
                .daysOfWeek(ask.days()).weeks(6).sessionMinutesTarget(ask.minutes()).build());
            IntakeBudget b = res.getIntakeBudget();
            assertThat(b).as(ask.toString()).isNotNull();
            int week1 = res.getCandidates().get(0).getTemplate().getDays().stream()
                .flatMap(d -> d.getExercises() == null ? java.util.stream.Stream.<GymExerciseInput>empty()
                    : d.getExercises().stream())
                .filter(e -> !Boolean.FALSE.equals(e.getCountsTowardVolume()))
                .mapToInt(GymExerciseInput::getWorkingSets).sum();
            assertThat(b.getUsedSets()).as(ask.toString()).isEqualTo(week1);
            if (Boolean.FALSE.equals(res.getNothingFits())) {
                assertThat(b.getCapacitySets()).as(ask.toString()).isNotNull()
                    .isGreaterThanOrEqualTo(b.getUsedSets());
            }
            assertThat(b.getEmphasizeCount()).isZero();
            assertThat(b.getEmphasizeMax()).isEqualTo(2);
            assertThat(b.getRaiseAllowed()).as(ask.toString()).hasSize(9);
        }
    }

    /** raiseAllowed[m] is exactly "the candidates call with only m one tier higher offers a candidate". */
    @Test
    void raiseAllowedMatchesARealRaise() {
        Map<String, String> pr = Map.of("back", "emphasize", "shoulder", "maintain", "biceps", "maintain",
            "triceps", "maintain", "quad", "maintain", "ham", "maintain", "glute", "maintain", "calf", "maintain");
        Set<String> days = Set.of("Hét", "Kedd", "Csü", "Pén");
        MesoPlanCandidates res = candidates(MesoPlanCandidatesRequest.builder()
            .daysOfWeek(days).weeks(6).sessionMinutesTarget(70).priorities(pr).build());
        assertThat(res.getNothingFits()).isFalse();
        Map<String, Boolean> allowed = res.getIntakeBudget().getRaiseAllowed();
        assertThat(allowed).doesNotContainKey("back").containsKeys("chest", "shoulder", "calf");
        for (String muscle : List.of("chest", "shoulder", "quad", "calf")) {
            Map<String, String> raised = new java.util.HashMap<>(pr);
            raised.put(muscle, "maintain".equals(pr.get(muscle)) ? "grow" : "emphasize");
            MesoPlanCandidates after = candidates(MesoPlanCandidatesRequest.builder()
                .daysOfWeek(days).weeks(6).sessionMinutesTarget(70).priorities(raised).build());
            assertThat(allowed.get(muscle)).as(muscle).isEqualTo(Boolean.FALSE.equals(after.getNothingFits()));
        }
    }

    @Test
    void raiseAllowedRespectsTheHangsulyCapAndNeedsATarget() {
        MesoPlanCandidates capped = candidates(MesoPlanCandidatesRequest.builder()
            .daysOfWeek(Set.of("Hét", "Kedd", "Csü", "Pén")).weeks(6).sessionMinutesTarget(120)
            .priorities(Map.of("back", "emphasize", "chest", "emphasize")).build());
        IntakeBudget b = capped.getIntakeBudget();
        assertThat(b.getEmphasizeCount()).isEqualTo(2);
        assertThat(b.getRaiseAllowed()).doesNotContainKeys("back", "chest").containsEntry("shoulder", false);

        MesoPlanCandidates untimed = candidates(MesoPlanCandidatesRequest.builder()
            .daysOfWeek(Set.of("Hét", "Kedd", "Csü", "Pén")).weeks(6).build());
        assertThat(untimed.getIntakeBudget().getCapacitySets()).isNull();
        assertThat(untimed.getIntakeBudget().getRaiseAllowed()).isEmpty();
    }

    @Test
    void noLlmCalled() {
        candidates(MesoPlanCandidatesRequest.builder()
            .daysOfWeek(Set.of("Hét", "Sze", "Pén")).weeks(6).build());
        verify(llm, never()).propose(any());

        // the mock is live: generate does consult it
        org.mockito.Mockito.when(llm.propose(any())).thenReturn(Optional.empty());
        postForBody("/api/train/meso-plans/generate", MesoPlanGenerateRequest.builder()
            .daysOfWeek(Set.of("Hét", "Sze", "Pén")).weeks(6).build(), ownerAuthHeaders(), HttpStatus.OK,
            MesoPlanGenerateResponse.class);
        verify(llm, times(1)).propose(any());
    }

    @Test
    void twoDays() {
        MesoPlanCandidates res = candidates(MesoPlanCandidatesRequest.builder()
            .daysOfWeek(Set.of("Hét", "Csü")).weeks(4).build());

        assertWellFormed(res);
        assertThat(res.getCandidates()).extracting(MesoPlanCandidate::getSplitKey).containsExactly("full2");
    }

    @Test
    void weekendGapDays() {
        MesoPlanCandidates res = candidates(MesoPlanCandidatesRequest.builder()
            .daysOfWeek(Set.of("Hét", "Kedd", "Szo", "Vas")).weeks(6).sessionMinutesTarget(60).build());

        assertWellFormed(res);
        if (Boolean.TRUE.equals(res.getNothingFits())) {
            assertThat(res.getFixes()).isNotNull();
        }
    }

    @Test
    void tightMinutesGivesNothingFitsWithMoreMinutes() {
        MesoPlanCandidates res = candidates(MesoPlanCandidatesRequest.builder()
            .daysOfWeek(Set.of("Hét", "Sze", "Pén")).weeks(6).sessionMinutesTarget(20).build());

        assertWellFormed(res);
        assertThat(res.getNothingFits()).isTrue();
        assertThat(res.getFixes()).extracting(CandidateFix::getCode)
            .contains(CandidateFix.CodeEnum.MORE_MINUTES, CandidateFix.CodeEnum.MORE_DAYS);
        CandidateFix more = res.getFixes().stream()
            .filter(f -> f.getCode() == CandidateFix.CodeEnum.MORE_MINUTES).findFirst().orElseThrow();
        int longest = res.getCandidates().get(0).getEvaluation().getDays().stream()
            .mapToInt(DayEvaluation::getMinutesEstimate).max().orElseThrow();
        assertThat(more.getValue()).isGreaterThanOrEqualTo(longest).isLessThan(longest + 15);
        assertThat(more.getValue() % 15).isZero();
    }

    @Test
    void allMaintainStillOffers() {
        Map<String, String> all = Map.of("chest", "maintain", "back", "maintain", "shoulder", "maintain",
            "biceps", "maintain", "triceps", "maintain", "quad", "maintain", "ham", "maintain", "glute", "maintain",
            "calf", "maintain");
        MesoPlanCandidates res = candidates(MesoPlanCandidatesRequest.builder()
            .daysOfWeek(Set.of("Hét", "Sze", "Pén", "Szo")).weeks(6).priorities(all).build());

        assertWellFormed(res);
        assertThat(res.getNothingFits()).isFalse();
        assertThat(res.getCandidates()).isNotEmpty();
    }

    @Test
    void threeEmphasize400() {
        String body = postForBody(CANDIDATES, Map.of("daysOfWeek", List.of("Hét", "Sze", "Pén", "Szo"), "weeks", 6,
            "priorities", Map.of("back", "emphasize", "chest", "emphasize", "quad", "emphasize")),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(body, "TRAIN_MESO_EMPHASIZE_CAP");
    }

    /** Warm-up rule (2026-11-21): isolations never warm up, only a group's first compound does; the ul2 upper day was
     *  77 min with a warm-up on every exercise. */
    @Test
    void candidatesMinutesDropWithWarmupRule() {
        MesoPlanCandidates res = candidates(MesoPlanCandidatesRequest.builder()
            .daysOfWeek(Set.of("Hét", "Kedd", "Csü", "Pén")).weeks(6).sessionMinutesTarget(80).build());

        MesoPlanCandidate ul2 = res.getCandidates().get(0);
        assertThat(ul2.getSplitKey()).isEqualTo("ul2");
        assertThat(ul2.getEvaluation().getDays()).filteredOn(d -> "Hét".equals(d.getDay()))
            .extracting(DayEvaluation::getMinutesEstimate).containsExactly(76);
    }

    /** Tartás starts at the band low (2026-11-21): back + chest Hangsúly, everything else Tartás — upper day ~74 min,
     *  so 75 fits (ul2 recommended) while 60 still does not (the Hangsúly upper day alone is over). */
    @Test
    void tartasAtBandLowFitsSeventyFiveButNotSixty() {
        Map<String, String> pr = Map.of("back", "emphasize", "chest", "emphasize", "shoulder", "maintain",
            "biceps", "maintain", "triceps", "maintain", "quad", "maintain", "ham", "maintain", "glute", "maintain",
            "calf", "maintain");
        MesoPlanCandidates at75 = candidates(MesoPlanCandidatesRequest.builder()
            .daysOfWeek(Set.of("Hét", "Kedd", "Csü", "Pén")).weeks(6).sessionMinutesTarget(75).priorities(pr).build());
        assertWellFormed(at75);
        assertThat(at75.getNothingFits()).isFalse();
        assertThat(at75.getCandidates().get(0).getSplitKey()).isEqualTo("ul2");
        assertThat(at75.getCandidates().get(0).getEvaluation().getDays()).extracting(DayEvaluation::getMinutesEstimate)
            .allSatisfy(m -> assertThat(m).isLessThanOrEqualTo(75));

        MesoPlanCandidates at60 = candidates(MesoPlanCandidatesRequest.builder()
            .daysOfWeek(Set.of("Hét", "Kedd", "Csü", "Pén")).weeks(6).sessionMinutesTarget(60).priorities(pr).build());
        assertWellFormed(at60);
        assertThat(at60.getNothingFits()).isTrue();
    }

    @Test
    void consolidationTwoWeeksAllMaintain() {
        MesoPlanCandidates res = candidates(MesoPlanCandidatesRequest.builder()
            .daysOfWeek(Set.of("Hét", "Kedd", "Csü", "Pén")).weeks(2).consolidation(true)
            .priorities(Map.of("chest", "emphasize")).build());
        assertThat(res.getCandidates()).isNotEmpty();
        assertThat(res.getCandidates()).allSatisfy(c -> {
            MesoTemplateUpsertRequest t = c.getTemplate();
            assertThat(t.getWeeks()).isEqualTo(2);
            assertThat(t.getMusclePriorities()).isNotEmpty().allSatisfy((k, v) -> assertThat(v).isEqualTo("maintain"));
            assertThat(t.getPhaseCurve()).extracting(Enum::name).containsExactly("MEV", "MEV");
            assertThat(t.getTitle()).isEqualTo("Lezárás");
            assertThat(t.getStyle()).isEqualTo("Lezárás · 2 hét");
        });
    }

    @Test
    void twoWeeksWithoutFlagIs400() {
        String body = postForBody(CANDIDATES, MesoPlanCandidatesRequest.builder()
            .daysOfWeek(Set.of("Hét", "Kedd", "Csü", "Pén")).weeks(2).build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(body, "TRAIN_MESO_WEEKS_RANGE");
    }

    @Test
    void consolidationFourWeeksIs400() {
        String body = postForBody(CANDIDATES, MesoPlanCandidatesRequest.builder()
            .daysOfWeek(Set.of("Hét", "Kedd", "Csü", "Pén")).weeks(4).consolidation(true).build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(body, "TRAIN_MESO_WEEKS_RANGE");
    }
}

package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import io.mrkuhne.mezo.feature.train.service.ExerciseSubstituteRanker.Signal;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.junit.jupiter.api.Test;

/** Exact Hungarian reason sentences of the reasoned swap (spec 2026-11-17 §6.2 step 4). */
class SubstituteReasonTest {

    @Test
    void sentence_shouldJoinRoleAndGoal() {
        assertThat(SubstituteReason.sentence(List.of(Signal.SAME_ROLE, Signal.GOAL_HYPERTROPHY), null))
            .isEqualTo("Ugyanazt a munkát végzi a tervben, stabil, könnyű benne terhelni — izomépítéshez jó.");
    }

    @Test
    void sentence_shouldNameCandidateType_forOtherType() {
        assertThat(SubstituteReason.sentence(List.of(Signal.OTHER_TYPE, Signal.SPARES_JOINT), null, "isolation"))
            .isEqualTo("Ugyanazt az izmot éri, de izolált mozgásként, nem terheli azt, ami most nem esett jól.");
        assertThat(SubstituteReason.sentence(List.of(Signal.OTHER_TYPE, Signal.HAS_EQUIPMENT), null, "compound"))
            .isEqualTo("Ugyanazt az izmot éri, de összetett mozgásként, és ehhez van eszközöd.");
    }

    @Test
    void sentence_shouldInsertPainJoint_forPainToday() {
        assertThat(SubstituteReason.sentence(List.of(Signal.SAME_ROLE, Signal.PAIN_TODAY), "a válladat"))
            .isEqualTo("Ugyanazt a munkát végzi a tervben, kíméli a válladat, amit ma jeleztél.");
    }

    @Test
    void sentence_shouldFallBack_whenPainJointUnknown() {
        assertThat(SubstituteReason.sentence(List.of(Signal.SAME_ROLE, Signal.PAIN_TODAY), null))
            .isEqualTo("Ugyanazt a munkát végzi a tervben, kíméli azt, amit ma jeleztél.");
    }

    @Test
    void sentence_shouldAppendMildBeforeAfterSemicolon() {
        assertThat(SubstituteReason.sentence(List.of(Signal.SAME_ROLE, Signal.MILD_BEFORE), null))
            .isEqualTo("Ugyanazt a munkát végzi a tervben; legutóbb enyhén érezted.");
    }

    @Test
    void sentence_shouldSayTheMuscleGetsLittle_forUnderBand() {
        assertThat(SubstituteReason.sentence(List.of(Signal.SAME_ROLE, Signal.UNDER_BAND), null))
            .isEqualTo("Ugyanazt a munkát végzi a tervben, ezen a héten kevés jut erre az izomra.");
    }

    @Test
    void sentence_shouldBeTheFixedLine_forCustom() {
        assertThat(SubstituteReason.sentence(List.of(Signal.SAME_ROLE, Signal.CUSTOM), null))
            .isEqualTo("Saját gyakorlat — erről még keveset tudok.");
    }

    @Test
    void sentence_shouldStandAlone_withRoleOnly() {
        assertThat(SubstituteReason.sentence(List.of(Signal.SAME_ROLE), null))
            .isEqualTo("Ugyanazt a munkát végzi a tervben.");
    }

    @Test
    void sentence_shouldCapitaliseOnce_whenNoRoleSignal() {
        assertThat(SubstituteReason.sentence(List.of(Signal.DONE_BEFORE), null))
            .isEqualTo("Ezt már csináltad, így látod, hol tartasz.");
    }

    @Test
    void phrases_shouldNeverPromiseRankOrNameAnExercise() throws Exception {
        List<String> texts = new ArrayList<>();
        for (Signal s : Signal.values()) {
            for (String type : new String[] {"compound", "isolation", null}) {
                texts.add(SubstituteReason.sentence(List.of(Signal.SAME_ROLE, s), "a válladat", type));
                texts.add(SubstituteReason.sentence(List.of(Signal.OTHER_TYPE, s), null, type));
            }
        }
        List<String> names = new ArrayList<>();
        try (InputStream in = getClass().getResourceAsStream("/content/exercise-catalog.json")) {
            for (JsonNode row : new ObjectMapper().readTree(in)) {
                names.add(row.get("name").asText().toLowerCase(Locale.ROOT));
            }
        }
        assertThat(names).hasSizeGreaterThan(100);
        for (String t : texts) {
            assertThat(t).doesNotContainIgnoringCase("legjobb").doesNotContain("%").doesNotContainPattern("\\d");
            String lower = t.toLowerCase(Locale.ROOT);
            assertThat(names).noneMatch(lower::contains);
        }
    }
}

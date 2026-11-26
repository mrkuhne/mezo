package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.service.CoverageRules.Code;
import io.mrkuhne.mezo.feature.train.service.CoverageRules.Day;
import io.mrkuhne.mezo.feature.train.service.CoverageRules.Finding;
import io.mrkuhne.mezo.feature.train.service.CoverageRules.Row;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The coverage rules table (mezo-r36n9.114, spec 2026-11-25-boop-hianyjelzes-design §Rules). */
class CoverageRulesTest {

    private static Row row(String muscle, String pattern, String... secondary) {
        return new Row(muscle, pattern, List.of(secondary), "compound");
    }

    private static Row custom(String muscle) {
        return new Row(muscle, null, null, null);
    }

    private static List<Finding> eval(Map<String, String> priorities, Row... rows) {
        return CoverageRules.evaluate(List.of(new Day(0, Arrays.asList(rows))), priorities);
    }

    private static List<Finding> eval(Row... rows) {
        return eval(Map.of(), rows);
    }

    private static List<Code> codes(List<Finding> findings) {
        return findings.stream().map(Finding::code).toList();
    }

    // --- Combhajlító

    @Test
    void ham_shouldMissKneeFlexion_whenOnlyHinged() {
        List<Finding> f = eval(row("ham", "hinge"));

        assertThat(codes(f)).containsExactly(Code.HAM_NO_KNEE_FLEXION);
        assertThat(f.get(0).group()).isEqualTo("ham");
        assertThat(f.get(0).missingPattern()).isEqualTo("knee-flexion");
        assertThat(f.get(0).targetTokens()).isNull();
    }

    @Test
    void ham_shouldMissHinge_whenOnlyCurled() {
        assertThat(codes(eval(row("ham", "knee-flexion")))).containsExactly(Code.HAM_NO_HINGE);
    }

    @Test
    void ham_shouldBeSilent_whenBothMovementsAreThere() {
        assertThat(eval(row("ham", "hinge"), row("ham", "knee-flexion"))).isEmpty();
    }

    @Test
    void ham_shouldIgnoreAGluteHinge() {
        // a hinge whose primary is the glute does not train the hamstring group
        assertThat(eval(row("glute", "hinge"))).isEmpty();
    }

    @Test
    void weekDays_shouldBeJudgedTogether() {
        List<Finding> f = CoverageRules.evaluate(List.of(
            new Day(0, List.of(row("ham", "hinge"))),
            new Day(3, List.of(row("ham", "knee-flexion")))), Map.of());

        assertThat(f).isEmpty();
    }

    // --- Comb

    @Test
    void quad_shouldMissKneeExtension_whenOnlySquatOrLunge() {
        assertThat(codes(eval(row("quad", "squat")))).containsExactly(Code.QUAD_NO_KNEE_EXTENSION);
        assertThat(codes(eval(row("quad", "lunge")))).containsExactly(Code.QUAD_NO_KNEE_EXTENSION);
        assertThat(eval(row("quad", "squat"), row("quad", "knee-extension"))).isEmpty();
    }

    @Test
    void quad_shouldBeSilent_withOnlyKneeExtension() {
        assertThat(eval(row("quad", "knee-extension"))).isEmpty();
    }

    // --- Hát

    @Test
    void back_shouldMissTheOtherPull_inBothDirections() {
        assertThat(codes(eval(row("back-wide", "vertical-pull")))).containsExactly(Code.BACK_NO_HORIZONTAL_PULL);
        assertThat(codes(eval(row("back-mid", "horizontal-pull")))).containsExactly(Code.BACK_NO_VERTICAL_PULL);
        assertThat(eval(row("back-wide", "vertical-pull"), row("back-mid", "horizontal-pull"))).isEmpty();
    }

    @Test
    void back_shouldNotCountARearDeltRowAsAHorizontalPull() {
        // the face-pull-like row is a shoulder row: the back group still lacks its horizontal pull
        assertThat(codes(eval(row("back-wide", "vertical-pull"), row("shoulder-rear", "horizontal-pull"))))
            .containsExactly(Code.BACK_NO_HORIZONTAL_PULL);
    }

    // --- Bicepsz / Tricepsz

    @Test
    void biceps_shouldMissElbowFlexion_whenWorkedOnlyAsASecondaryOfPulls() {
        List<Finding> f = eval(row("back-wide", "vertical-pull", "biceps-short"),
            row("back-mid", "horizontal-pull", "biceps-brachialis"));

        assertThat(codes(f)).containsExactly(Code.BICEPS_NO_ELBOW_FLEXION);
        assertThat(f.get(0).group()).isEqualTo("biceps");
        assertThat(f.get(0).missingPattern()).isEqualTo("elbow-flexion");
    }

    @Test
    void biceps_shouldBeSilent_withADirectCurl() {
        assertThat(eval(row("back-wide", "vertical-pull", "biceps-short"), row("back-mid", "horizontal-pull"),
            row("biceps-long", "elbow-flexion"))).isEmpty();
    }

    @Test
    void biceps_shouldBeSilent_whenNoPullAssistsIt() {
        // a biceps secondary on a non-pull row is not „work as a secondary of pulls"
        assertThat(eval(row("glute", "hip-extension", "biceps-long"))).isEmpty();
    }

    @Test
    void triceps_shouldMissElbowExtension_whenWorkedOnlyAsASecondaryOfPresses() {
        List<Finding> f = eval(row("chest-mid", "horizontal-push", "triceps-lateral"), row("chest-mid", "fly"));

        assertThat(codes(f)).containsExactly(Code.TRICEPS_NO_ELBOW_EXTENSION);
        assertThat(eval(row("chest-mid", "horizontal-push", "triceps-lateral"), row("chest-mid", "fly"),
            row("triceps-long", "elbow-extension"))).isEmpty();
    }

    @Test
    void triceps_shouldBeSilent_whenAPrimaryTricepsPressIsThere() {
        // a close-grip / JM press trains the triceps directly — not „only as a secondary"
        assertThat(eval(row("shoulder-front", "vertical-push", "triceps-long", "shoulder-side"),
            row("shoulder-side", "raise"), row("triceps-lateral", "horizontal-push"))).isEmpty();
    }

    // --- Váll

    @Test
    void shoulder_shouldMissASideRaise_whenOnlyPressedOverhead() {
        List<Finding> f = eval(row("shoulder-front", "vertical-push"));

        assertThat(codes(f)).containsExactly(Code.SHOULDER_NO_SIDE_RAISE);
        assertThat(f.get(0).missingPattern()).isEqualTo("raise");
        assertThat(f.get(0).targetTokens()).containsExactly("shoulder-side");
    }

    @Test
    void shoulder_shouldNotCountAFrontRaise() {
        assertThat(codes(eval(row("shoulder-front", "vertical-push"), row("shoulder-front", "raise"))))
            .containsExactly(Code.SHOULDER_NO_SIDE_RAISE);
        assertThat(eval(row("shoulder-front", "vertical-push"), row("shoulder-side", "raise"))).isEmpty();
    }

    // --- Mell

    @Test
    void chest_shouldMissAFly_whenOnlyPressed() {
        assertThat(codes(eval(row("chest-mid", "horizontal-push"), row("triceps-long", "elbow-extension"))))
            .containsExactly(Code.CHEST_NO_FLY);
        assertThat(eval(row("chest-mid", "horizontal-push"), row("chest-upper", "fly"),
            row("triceps-long", "elbow-extension"))).isEmpty();
    }

    // --- Tartás, untrained, custom

    @Test
    void maintainTier_shouldSilenceTheGroup() {
        assertThat(eval(Map.of("ham", "maintain"), row("ham", "hinge"))).isEmpty();
        // Hangsúly / Építés still speak
        assertThat(codes(eval(Map.of("ham", "emphasize"), row("ham", "hinge"))))
            .containsExactly(Code.HAM_NO_KNEE_FLEXION);
    }

    @Test
    void maintainTier_shouldSilenceASecondaryOnlyGroup() {
        assertThat(eval(Map.of("biceps", "maintain"), row("back-wide", "vertical-pull", "biceps-short"),
            row("back-mid", "horizontal-pull"))).isEmpty();
    }

    @Test
    void untrainedGroups_shouldBeSilent() {
        assertThat(eval()).isEmpty();
        assertThat(eval(row("calf", "calf-raise"), row("core", "trunk-stability"))).isEmpty();
    }

    @Test
    void customRows_shouldNeverCreateAGap() {
        assertThat(eval(custom("ham"))).isEmpty();
        assertThat(eval(custom("quad"), custom("chest-mid"), custom("back-mid"))).isEmpty();
    }

    @Test
    void customRows_shouldNeverStandInForTheMissingMovement_butKeepTheGroupUnknown() {
        // a custom hamstring row could be the leg curl: the group's verdict is unknown, so it stays silent
        assertThat(eval(row("ham", "hinge"), custom("ham"))).isEmpty();
        // a custom biceps row is direct biceps work: not „only as a secondary"
        assertThat(eval(row("back-wide", "vertical-pull", "biceps-short"), row("back-mid", "horizontal-pull"),
            custom("biceps-long"))).isEmpty();
        // a custom row of another group changes nothing
        assertThat(codes(eval(row("ham", "hinge"), custom("chest-mid")))).containsExactly(Code.HAM_NO_KNEE_FLEXION);
    }

    @Test
    void nullOrBlankMuscles_shouldBeIgnored() {
        assertThat(eval(new Row(null, "hinge", null, null), new Row(" ", null, null, null))).isEmpty();
    }

    // --- caps and priority

    @Test
    void findings_shouldBeCappedAtThree_inTablePriorityOrder() {
        List<Finding> f = eval(
            row("chest-mid", "horizontal-push", "triceps-lateral"),     // chest (no fly), triceps (secondary only)
            row("shoulder-front", "vertical-push"),                     // shoulder (no side raise)
            row("back-wide", "vertical-pull", "biceps-short"),          // back (no row), biceps (secondary only)
            row("quad", "squat"),                                       // quad (no extension)
            row("ham", "hinge"));                                       // ham (no curl)

        assertThat(codes(f)).containsExactly(Code.HAM_NO_KNEE_FLEXION, Code.QUAD_NO_KNEE_EXTENSION,
            Code.BACK_NO_HORIZONTAL_PULL);
    }

    @Test
    void findings_shouldKeepTablePriority_whenTheTopGroupsAreSilent() {
        List<Finding> f = eval(Map.of("back", "maintain"),
            row("chest-mid", "horizontal-push", "triceps-lateral"),
            row("shoulder-front", "vertical-push"),
            row("back-wide", "vertical-pull", "biceps-short"));

        assertThat(codes(f)).containsExactly(Code.BICEPS_NO_ELBOW_FLEXION, Code.TRICEPS_NO_ELBOW_EXTENSION,
            Code.SHOULDER_NO_SIDE_RAISE);
    }

    @Test
    void chest_shouldBeTheLowestPriority() {
        List<Finding> f = eval(row("chest-mid", "horizontal-push"), row("shoulder-front", "vertical-push"));

        assertThat(codes(f)).containsExactly(Code.SHOULDER_NO_SIDE_RAISE, Code.CHEST_NO_FLY);
    }

    @Test
    void findings_shouldBeAtMostOnePerGroup() {
        List<Finding> f = eval(row("back-wide", "vertical-pull"), row("back-wide", "vertical-pull"),
            row("ham", "hinge"), row("ham", "hinge"));

        assertThat(f).extracting(Finding::group).doesNotHaveDuplicates().containsExactly("ham", "back");
    }

    @Test
    void everyCode_shouldMapToItsTableRow() {
        assertThat(Code.values()).extracting(Code::group).containsExactly(
            "ham", "ham", "quad", "back", "back", "biceps", "triceps", "shoulder", "chest");
        assertThat(Code.values()).extracting(Code::missingPattern).containsExactly(
            "knee-flexion", "hinge", "knee-extension", "horizontal-pull", "vertical-pull", "elbow-flexion",
            "elbow-extension", "raise", "fly");
    }

    // --- fixed phrases

    @Test
    void phrases_shouldBeFixedPlainSentences_withoutDigitsRankOrNames() throws Exception {
        List<String> names = new ArrayList<>();
        try (InputStream in = getClass().getResourceAsStream("/content/exercise-catalog.json")) {
            for (JsonNode row : new ObjectMapper().readTree(in)) {
                names.add(row.get("name").asText().toLowerCase(Locale.ROOT));
            }
        }
        assertThat(names).hasSizeGreaterThan(100);
        List<String> coaches = List.of("nippard", "israetel", "schoenfeld", "helms", "mezo");
        for (Code c : Code.values()) {
            for (String t : List.of(c.verdictText(), c.whyText())) {
                assertThat(t).isNotBlank().endsWith(".").doesNotContainIgnoringCase("legjobb")
                    .doesNotContain("%").doesNotContainPattern("\\d");
                String lower = t.toLowerCase(Locale.ROOT);
                assertThat(names).noneMatch(lower::contains);
                assertThat(coaches).noneMatch(lower::contains);
            }
            assertThat(c.verdictText()).startsWith("Hiányzik");
        }
        assertThat(Arrays.stream(Code.values()).map(Code::verdictText)).doesNotHaveDuplicates();
    }
}

package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.tools.ToolText;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/**
 * mezo-4jux: the provenance chips' presence filter. A ref candidate whose snapshot block rendered
 * as {@link ToolText#NO_DATA} must never be OFFERED to the model, so it cannot be cited at all.
 *
 * <p>The shipped defect: the morning card's body correctly said "Gyógyszerre vonatkozó adat nincs
 * rögzítve" — the snapshot had honestly rendered {@code [Gyógyszer] nincs adat} — while the card's
 * "Amire épült" row still showed a "Gyógyszer ×1" chip. A grounding row that can assert a
 * provenance the snapshot explicitly denied is unfalsifiable, and auditing where a claim came from
 * is its only purpose.
 *
 * <p>Pure unit test over the static lists + the filter: the snapshot lines below are hand-written
 * in {@code ContextSnapshotAssembler}'s exact shape, so a marker rename shows up here as a dropped
 * chip rather than as a silently fabricated one.
 */
class CompanionFeedCandidatePresenceTest {

    private static final String GOAL_LINE =
            "[Cél] Nyári cut (fogyás): 86,0 → 80,0 kg, 2026-06-01 → 2026-09-01, 6. hét";
    private static final String GOAL_ABSENT = "[Cél] " + ToolText.NO_DATA;

    private static final String TRAIN_LINE =
            "[Edzés] mezociklus: Hipertrófia — 2/6. hét (push-pull); Ma (terv): pihenőnap (gym)";
    /** No active mesocycle — the [Edzés] block still renders its trailing plan/digest segments,
     *  so the absence sits mid-line, after the block's own "mezociklus: " label. */
    private static final String TRAIN_ABSENT =
            "[Edzés] mezociklus: " + ToolText.NO_DATA + "; Ma (terv): pihenőnap (gym)";

    /** The fuel block always renders figures (a day with nothing logged is 0/target, not absent),
     *  so FuelDay is honestly present even on an empty day. */
    private static final String FUEL_LINE =
            "[Mai üzemanyag] 0/2200 kcal, fehérje 0/170 g; protokoll: " + ToolText.NO_DATA;

    private static final String MED_LINE = "[Gyógyszer] Ozempic: ciklus 3. nap (emelés)";
    private static final String MED_ABSENT = "[Gyógyszer] " + ToolText.NO_DATA;

    private static final String SLEEP_LINE =
            "[Regeneráció] alvás (2026-09-08): 7,5 h, minőség 8/10; check-in (2026-09-08 06:30): ok";
    private static final String SLEEP_ABSENT =
            "[Regeneráció] alvás: " + ToolText.NO_DATA + "; check-in: " + ToolText.NO_DATA;

    private static final String PROFILE_LINE = "[Profil] 180 cm, 41 év, férfi; mérés: 83,3 kg "
            + "(2026-09-08); súlytrend: 83,7 kg, heti -0,24 kg";
    private static final String PROFILE_TREND_ABSENT =
            "[Profil] 180 cm, 41 év, férfi; mérés: 83,3 kg (2026-09-08); súlytrend: " + ToolText.NO_DATA;

    @Test
    void testPresentCandidates_shouldNotOfferTheSourceThatRenderedAsAbsent() {
        String snapshot = snapshot(GOAL_LINE, TRAIN_LINE, FUEL_LINE, MED_ABSENT);

        assertThat(kinds(CompanionMessageGenerator.presentCandidates(
                CompanionMessageGenerator.MORNING_CANDIDATES, snapshot)))
                .containsExactly("Goal", "Workout", "FuelDay");
    }

    @Test
    void testPresentCandidates_shouldOfferEverySourceThatRendered() {
        String snapshot = snapshot(GOAL_LINE, TRAIN_LINE, FUEL_LINE, MED_LINE);

        assertThat(kinds(CompanionMessageGenerator.presentCandidates(
                CompanionMessageGenerator.MORNING_CANDIDATES, snapshot)))
                .containsExactly("Goal", "Workout", "FuelDay", "Medication");
    }

    /** A brand-new account: only the fuel day renders, so only the fuel day may be cited. */
    @Test
    void testPresentCandidates_shouldOfferOnlyTheFuelDay_whenNothingElseIsSetUp() {
        String snapshot = snapshot(GOAL_ABSENT, TRAIN_ABSENT, FUEL_LINE, MED_ABSENT);

        assertThat(kinds(CompanionMessageGenerator.presentCandidates(
                CompanionMessageGenerator.MORNING_CANDIDATES, snapshot)))
                .containsExactly("FuelDay");
    }

    /** Fail-CLOSED: a block that is not in this snapshot variant at all (the morning variant
     *  renders no sleep) is absence, not "unknown, offer it anyway". */
    @Test
    void testPresentCandidates_shouldDropACandidateWhoseBlockIsMissingEntirely() {
        assertThat(CompanionMessageGenerator.presentCandidates(
                CompanionMessageGenerator.SLEEP_CANDIDATES, snapshot(FUEL_LINE))).isEmpty();
    }

    @Test
    void testPresentCandidates_shouldOfferSleep_whenTheNightRendered() {
        String snapshot = snapshot(GOAL_LINE, TRAIN_LINE, SLEEP_LINE);

        assertThat(kinds(CompanionMessageGenerator.presentCandidates(
                CompanionMessageGenerator.SLEEP_CANDIDATES, snapshot)))
                .containsExactly("Sleep", "Goal", "Workout");
    }

    @Test
    void testPresentCandidates_shouldNotOfferSleep_whenTheRecoveryBlockRenderedAbsence() {
        String snapshot = snapshot(GOAL_LINE, TRAIN_LINE, SLEEP_ABSENT);

        assertThat(kinds(CompanionMessageGenerator.presentCandidates(
                CompanionMessageGenerator.SLEEP_CANDIDATES, snapshot)))
                .containsExactly("Goal", "Workout");
    }

    @Test
    void testPresentCandidates_shouldOfferWeightTrend_whenTheProfileBlockRenderedATrend() {
        String snapshot = snapshot(PROFILE_LINE, GOAL_LINE, FUEL_LINE);

        assertThat(kinds(CompanionMessageGenerator.presentCandidates(
                CompanionMessageGenerator.WEIGHT_CANDIDATES, snapshot)))
                .containsExactly("WeightTrend", "Goal", "FuelDay");
    }

    /** The first-ever weigh-in has no trend line yet — so "súlytrend" is not a citable source. */
    @Test
    void testPresentCandidates_shouldNotOfferWeightTrend_whenThereIsNoTrendYet() {
        String snapshot = snapshot(PROFILE_TREND_ABSENT, GOAL_LINE, FUEL_LINE);

        assertThat(kinds(CompanionMessageGenerator.presentCandidates(
                CompanionMessageGenerator.WEIGHT_CANDIDATES, snapshot)))
                .containsExactly("Goal", "FuelDay");
    }

    /** The filter is fail-closed, so a hardcoded candidate with no probe would never be offered at
     *  all — a silent feature loss instead of a loud failure. This is the guard for that. */
    @Test
    void testSnapshotProbes_shouldCoverEveryHardcodedCandidateKind() {
        String[] kinds = Stream.of(
                        CompanionMessageGenerator.MORNING_CANDIDATES,
                        CompanionMessageGenerator.SLEEP_CANDIDATES,
                        CompanionMessageGenerator.WEIGHT_CANDIDATES)
                .flatMap(List::stream)
                .map(CompanionMessageEnvelope.Ref::kind)
                .distinct()
                .toArray(String[]::new);

        assertThat(CompanionMessageGenerator.SNAPSHOT_PROBES).containsKeys(kinds);
    }

    /** The fixtures are whole snapshots, header line included, not a bare pile of blocks — the
     *  filter must find its probes regardless of what precedes them. */
    private static String snapshot(String... blocks) {
        return "\n\nAKTUÁLIS ÁLLAPOT (pillanatkép — 2026-09-08):\n" + String.join("\n", blocks) + "\n";
    }

    private static List<String> kinds(List<CompanionMessageEnvelope.Ref> refs) {
        return refs.stream().map(CompanionMessageEnvelope.Ref::kind).toList();
    }
}

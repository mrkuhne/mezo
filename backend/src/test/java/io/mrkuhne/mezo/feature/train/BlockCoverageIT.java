package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.BlockCoverageRequest;
import io.mrkuhne.mezo.api.dto.BlockCoverageResponse;
import io.mrkuhne.mezo.api.dto.CoverageDraftDay;
import io.mrkuhne.mezo.api.dto.CoverageFinding;
import io.mrkuhne.mezo.api.dto.CoverageProposal;
import io.mrkuhne.mezo.api.dto.GymProfile;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP read of the block builder's coverage hints (mezo-r36n9.114, spec 2026-11-25-boop-hianyjelzes-design). */
class BlockCoverageIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator trainPopulator;
    @Autowired private ExerciseCatalogRepository catalogRepository;
    @Autowired private MesocycleRepository mesocycleRepository;

    private UUID user;
    private HttpHeaders auth;
    private MesocycleEntity block;

    @BeforeEach
    void setUp() {
        RegisteredUser u = registerUser("Block Coverage");
        user = u.id();
        auth = u.headers();
        block = trainPopulator.createMesocycle(u.id(), "block", "active");
        block.setTrainingStyle("balanced");
        block = mesocycleRepository.saveAndFlush(block);
    }

    private UUID catalog(String name) {
        return catalogRepository.findAll().stream().filter(c -> c.getName().equals(name)).findFirst()
            .map(ExerciseCatalogEntity::getId).orElseThrow();
    }

    private static String uri(MesocycleEntity meso) {
        return "/api/train/mesocycles/" + meso.getId() + "/coverage";
    }

    private static CoverageDraftDay day(int index, Integer minutes, UUID... ids) {
        return new CoverageDraftDay().dayIndex(index).minutesEstimate(minutes).catalogIds(List.of(ids));
    }

    /** Hamstrings only hinged: Monday (long) and Thursday (short) — the leg curl is missing. */
    private BlockCoverageRequest hingeOnlyWeek() {
        return new BlockCoverageRequest().days(List.of(
            day(0, 70, catalog("Romanian Deadlift")),
            day(3, 45, catalog("Good Morning")),
            day(5, 30, catalog("Lateral Raise"))));
    }

    private BlockCoverageResponse read(BlockCoverageRequest req) {
        return postForBody(uri(block), req, auth, HttpStatus.OK, BlockCoverageResponse.class);
    }

    private void offKinds(String... kinds) {
        putForBody("/api/train/gym-profile", new GymProfile().offKinds(List.of(kinds)).missingExerciseIds(List.of()),
            auth, HttpStatus.OK, GymProfile.class);
    }

    @Test
    void testCoverage_shouldProposeALegCurlOnTheShortestHamDay_whenTheWeekOnlyHinges() {
        BlockCoverageResponse res = read(hingeOnlyWeek());

        assertThat(res.getFindings()).hasSize(1);
        CoverageFinding f = res.getFindings().get(0);
        assertThat(f.getGroup()).isEqualTo("ham");
        assertThat(f.getCode()).isEqualTo(CoverageFinding.CodeEnum.HAM_NO_KNEE_FLEXION);
        assertThat(f.getMissingPattern()).isEqualTo("knee-flexion");
        assertThat(f.getMuscles()).containsExactly("ham");
        assertThat(f.getVerdictText()).startsWith("Hiányzik").endsWith(".");
        assertThat(f.getWhyText()).isNotBlank().endsWith(".");

        CoverageProposal p = f.getProposal();
        assertThat(p).isNotNull();
        assertThat(p.getExercise().getPattern()).isEqualTo("knee-flexion");
        assertThat(p.getExercise().getMuscle()).isEqualTo("ham");
        // Thursday trains the hamstrings with the shorter session (Saturday is shorter but has no ham work)
        assertThat(p.getDayIndex()).isEqualTo(3);
        assertThat(p.getReasonText()).isNotBlank().endsWith(".").doesNotStartWith("Ugyanazt");
        assertThat(p.getPrescription()).isNotNull();
        assertThat(p.getPrescription().getWorkingSets()).isPositive();
        assertThat(p.getPrescription().getRepMax()).isGreaterThanOrEqualTo(p.getPrescription().getRepMin());
    }

    @Test
    void testCoverage_shouldReturnNullPrescription_whenTheBlockIsUnstyled() {
        block.setTrainingStyle(null);
        mesocycleRepository.saveAndFlush(block);

        CoverageProposal p = read(hingeOnlyWeek()).getFindings().get(0).getProposal();

        assertThat(p).isNotNull();
        assertThat(p.getPrescription()).isNull();
    }

    @Test
    void testCoverage_shouldProposeOnlyWhatTheGymHas_whenMachinesAreOff() {
        offKinds("machine");

        CoverageProposal p = read(hingeOnlyWeek()).getFindings().get(0).getProposal();

        assertThat(p).isNotNull();
        assertThat(p.getExercise().getGear()).doesNotContain("machine");
        assertThat(p.getExercise().getPattern()).isEqualTo("knee-flexion");
    }

    @Test
    void testCoverage_shouldKeepTheFindingWithoutAProposal_whenNoCandidateIsAvailable() {
        offKinds("machine", "specialty");

        BlockCoverageResponse res = read(hingeOnlyWeek());

        assertThat(res.getFindings()).hasSize(1);
        assertThat(res.getFindings().get(0).getCode()).isEqualTo(CoverageFinding.CodeEnum.HAM_NO_KNEE_FLEXION);
        assertThat(res.getFindings().get(0).getProposal()).isNull();
    }

    @Test
    void testCoverage_shouldProposeASideRaise_whenOnlyPressingOverhead() {
        // the front raise is not a side raise; the press's triceps secondary also lacks its own extension (higher priority)
        BlockCoverageResponse res = read(new BlockCoverageRequest().days(List.of(
            day(1, 50, catalog("DB Front Raise"), catalog("Overhead Press")))));

        assertThat(res.getFindings()).extracting(CoverageFinding::getCode).containsExactly(
            CoverageFinding.CodeEnum.TRICEPS_NO_ELBOW_EXTENSION, CoverageFinding.CodeEnum.SHOULDER_NO_SIDE_RAISE);
        CoverageFinding f = res.getFindings().get(1);
        assertThat(f.getMuscles()).containsExactly("shoulder-side");
        assertThat(f.getProposal()).isNotNull();
        assertThat(f.getProposal().getExercise().getMuscle()).isEqualTo("shoulder-side");
        assertThat(f.getProposal().getExercise().getPattern()).isEqualTo("raise");
        assertThat(f.getProposal().getDayIndex()).isEqualTo(1);
        // a secondary-only group lands on the day whose press already works it
        assertThat(res.getFindings().get(0).getProposal()).isNotNull();
        assertThat(res.getFindings().get(0).getProposal().getDayIndex()).isEqualTo(1);
    }

    @Test
    void testCoverage_shouldBeSilent_forAMaintainedGroup() {
        block.setMusclePriorities(Map.of("ham", "maintain"));
        mesocycleRepository.saveAndFlush(block);

        assertThat(read(hingeOnlyWeek()).getFindings()).isEmpty();
    }

    @Test
    void testCoverage_shouldReturnNoFindings_whenTheDraftIsEmpty() {
        assertThat(read(new BlockCoverageRequest().days(List.of())).getFindings()).isEmpty();
        assertThat(read(new BlockCoverageRequest().days(List.of(day(0, null)))).getFindings()).isEmpty();
    }

    @Test
    void testCoverage_shouldIgnoreUnknownIds() {
        assertThat(read(new BlockCoverageRequest().days(List.of(day(0, 40, UUID.randomUUID())))).getFindings())
            .isEmpty();
    }

    @Test
    void testCoverage_shouldReturn400_whenADayIndexIsOutOfRange() {
        postForBody(uri(block), new BlockCoverageRequest().days(List.of(day(7, 30))), auth, HttpStatus.BAD_REQUEST,
            String.class);
    }

    @Test
    void testCoverage_shouldReturn404_whenTheBlockIsAnotherUsers() {
        HttpHeaders other = registerUser("Block Coverage Other").headers();

        postForBody(uri(block), hingeOnlyWeek(), other, HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testCoverage_shouldReturn409_whenTheBlockIsArchived() {
        RegisteredUser owner = registerUser("Block Coverage Archived");
        MesocycleEntity archived = trainPopulator.createMesocycle(owner.id(), "old", "archived");

        postForBody(uri(archived), hingeOnlyWeek(), owner.headers(), HttpStatus.CONFLICT, String.class);
    }

    @Test
    void testCoverage_shouldRankALegCurlAsTheSameRole_notAnotherType() {
        CoverageProposal p = read(hingeOnlyWeek()).getFindings().get(0).getProposal();

        assertThat(p.getExercise().getType()).hasToString("isolation");
        assertThat(p.getSignals()).contains("SAME_ROLE").doesNotContain("OTHER_TYPE");
    }

    @Test
    void testCoverage_shouldIgnoreAnotherUsersCustomRow_butLetTheOwnOneSilenceTheGroup() {
        UUID foreign = trainPopulator.createUserCatalogExercise(registerUser("Coverage Stranger").id(),
            "Stranger Curl", "ham", "isolation").getId();
        UUID own = trainPopulator.createUserCatalogExercise(user, "My Curl", "ham", "isolation").getId();

        BlockCoverageResponse withForeign = read(new BlockCoverageRequest().days(List.of(
            day(0, 60, catalog("Romanian Deadlift"), foreign))));
        BlockCoverageResponse withOwn = read(new BlockCoverageRequest().days(List.of(
            day(0, 60, catalog("Romanian Deadlift"), own))));

        // the stranger's row is not in the viewer's pool: ignored, the leg curl is still missing
        assertThat(withForeign.getFindings()).extracting(CoverageFinding::getCode)
            .containsExactly(CoverageFinding.CodeEnum.HAM_NO_KNEE_FLEXION);
        // the viewer's own custom row could be the leg curl: unknown, silent
        assertThat(withOwn.getFindings()).isEmpty();
    }

    @Test
    void testCoverage_shouldSkipARowThatHurtBefore() {
        offKinds("machine"); // the Nordic curl is the only knee-flexion row left
        UUID nordic = catalog("Nordic Ham Curl");
        assertThat(read(hingeOnlyWeek()).getFindings().get(0).getProposal().getExercise().getId()).isEqualTo(nordic);

        WorkoutSessionEntity past = trainPopulator.createTemplateDay(user, block.getId(), "Past");
        ExerciseEntity ex = trainPopulator.createExercise(user, past.getId(), "Nordic Ham Curl", 0, "ham", "isolation",
            nordic);
        WorkoutSessionEntity done = trainPopulator.completedInstanceWithWorkingSet(
            user, ex.getWorkoutSessionId(), ex.getId(), new BigDecimal("0"), 6, 1);
        trainPopulator.createFeedback(user, done.getId(), ex.getId(), 3, 3, 2);

        BlockCoverageResponse res = read(hingeOnlyWeek());

        assertThat(res.getFindings()).hasSize(1);
        assertThat(res.getFindings().get(0).getProposal()).isNull();
    }
}

package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.YearBlock;
import io.mrkuhne.mezo.api.dto.YearNote;
import io.mrkuhne.mezo.api.dto.YearPlan;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * The Éves terv API (mezo-r36n9.113 Task 5): preview, create, active, block PATCH, archive. The clock is pinned to
 * Saturday 2026-11-21 (owner zone); plans start Monday 2027-01-04 unless a running block is adopted. With 6-week
 * blocks and a 2-week consolidation a year holds 8 loading blocks + the consolidation and a 2-week buffer.
 * All values invented.
 */
@Import(YearPlanContractIT.PinnedClockConfig.class)
class YearPlanContractIT extends ApiIntegrationTest {

    private static final String PLANS = "/api/train/year-plans";
    private static final String BLOCKS = PLANS + "/blocks/";
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 21);
    private static final LocalDate START = LocalDate.of(2027, 1, 4);
    private static final ZoneId BUD = ZoneId.of("Europe/Budapest");

    @TestConfiguration
    static class PinnedClockConfig {
        @Bean
        Clock yearPlanTestClock() {
            return Clock.fixed(TODAY.atTime(9, 0).atZone(BUD).toInstant(), BUD);
        }
    }

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private MesocycleRepository mesocycleRepository;
    @Autowired private JdbcTemplate jdbc;

    private UUID owner() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private static Map<String, Object> request(LocalDate start) {
        Map<String, Object> r = new HashMap<>();
        r.put("startDate", start.toString());
        return r;
    }

    private YearPlan create(HttpHeaders auth) {
        return postForBody(PLANS, request(START), auth, HttpStatus.CREATED, YearPlan.class);
    }

    private YearPlan active(HttpHeaders auth) {
        return getForBody(PLANS + "/active", auth, HttpStatus.OK, YearPlan.class);
    }

    private YearPlan patch(UUID blockId, Map<String, Object> body, HttpHeaders auth) {
        return patchForBody(BLOCKS + blockId, body, auth, HttpStatus.OK, YearPlan.class);
    }

    private static YearBlock at(YearPlan plan, int ordinal) {
        return plan.getBlocks().stream().filter(b -> b.getOrdinal() == ordinal).findFirst().orElseThrow();
    }

    private static void assertContiguous(YearPlan plan) {
        assertThat(plan.getBlocks()).extracting(YearBlock::getOrdinal)
            .containsExactlyElementsOf(IntStream.rangeClosed(1, plan.getBlocks().size()).boxed().toList());
        assertThat(plan.getBlocks().get(plan.getBlocks().size() - 1).getKind())
            .isEqualTo(YearBlock.KindEnum.CONSOLIDATION);
    }

    private int count(String sql, Object... args) {
        Integer n = jdbc.queryForObject(sql, Integer.class, args);
        return n == null ? 0 : n;
    }

    @Test
    void previewPersistsNothing() {
        owner();
        YearPlan preview = postForBody(PLANS + "/preview", request(START), ownerAuthHeaders(), HttpStatus.OK,
            YearPlan.class);

        assertThat(preview.getId()).isNull();
        assertThat(preview.getBlocks()).hasSize(9).allSatisfy(b -> assertThat(b.getId()).isNull());
        assertThat(count("select count(*) from training_year_plan")).isZero();
        assertThat(count("select count(*) from training_year_block")).isZero();
    }

    @Test
    void createThenActive() {
        owner();
        HttpHeaders auth = ownerAuthHeaders();
        YearPlan created = create(auth);
        YearPlan plan = active(auth);

        assertThat(plan.getId()).isEqualTo(created.getId());
        assertThat(plan.getStatus()).isEqualTo(YearPlan.StatusEnum.ACTIVE);
        assertThat(plan.getStartDate()).isEqualTo(START);
        assertThat(plan.getBlocks()).hasSize(9);
        assertContiguous(plan);
        for (int i = 1; i <= 8; i++) {
            YearBlock b = at(plan, i);
            assertThat(b.getPlannedStart()).isEqualTo(START.plusWeeks(6L * (i - 1)));
            assertThat(b.getLastDay()).isEqualTo(START.plusWeeks(6L * i).minusDays(1));
            assertThat(b.getStatus()).isEqualTo(YearBlock.StatusEnum.PLANNED);
            assertThat(b.getKind()).isEqualTo(i % 2 == 1 ? YearBlock.KindEnum.UPPER : YearBlock.KindEnum.LOWER);
            assertThat(b.getFocus()).hasSizeBetween(1, 2);
        }
        YearBlock cons = at(plan, 9);
        assertThat(cons.getPlannedStart()).isEqualTo(START.plusWeeks(50));
        assertThat(cons.getWeeks()).isEqualTo(2);
        assertThat(plan.getEndDate()).isEqualTo(START.plusWeeks(52).minusDays(1));
        assertThat(plan.getLoadingBlocks()).isEqualTo(8);
        assertThat(plan.getBufferWeeks()).isEqualTo(2);
        assertThat(plan.getBufferStart()).isEqualTo(START.plusWeeks(48));
        assertThat(plan.getOverrunWeeks()).isZero();
        assertThat(plan.getCurrentWeek()).isNull();
        assertThat(plan.getFocusCount()).hasSize(9);
        assertThat(plan.getReview().getBlocksDone()).isZero();
        // planned_start persisted from the layout
        assertThat(jdbc.queryForObject("select planned_start from training_year_block where plan_id = ? and ordinal = 2",
            LocalDate.class, plan.getId())).isEqualTo(START.plusWeeks(6));
    }

    @Test
    void secondCreate409_replaceActiveArchivesOld() {
        owner();
        HttpHeaders auth = ownerAuthHeaders();
        YearPlan first = create(auth);

        String body = postForBody(PLANS, request(START), auth, HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "TRAIN_YEAR_PLAN_ACTIVE_EXISTS");

        Map<String, Object> replace = request(START.plusWeeks(1));
        replace.put("replaceActive", true);
        YearPlan second = postForBody(PLANS, replace, auth, HttpStatus.CREATED, YearPlan.class);

        assertThat(second.getId()).isNotEqualTo(first.getId());
        assertThat(jdbc.queryForObject("select status from training_year_plan where id = ?", String.class,
            first.getId())).isEqualTo("archived");
        assertThat(active(auth).getId()).isEqualTo(second.getId());
    }

    @Test
    void notMonday400() {
        owner();
        String body = postForBody(PLANS, request(START.plusDays(1)), ownerAuthHeaders(), HttpStatus.BAD_REQUEST,
            String.class);
        assertHasRequestError(body, "TRAIN_YEAR_START_NOT_MONDAY");
    }

    @Test
    void noPlan404() {
        owner();
        String body = getForBody(PLANS + "/active", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "TRAIN_YEAR_PLAN_NONE");
    }

    @Test
    void patchFocusAcceptedWithWarning() {
        owner();
        HttpHeaders auth = ownerAuthHeaders();
        YearPlan plan = create(auth);
        String borrowed = at(plan, 2).getFocus().get(0);

        YearPlan after = patch(at(plan, 3).getId(), Map.of("focus", List.of(borrowed)), auth);

        assertThat(at(after, 3).getFocus()).containsExactly(borrowed);
        assertThat(at(after, 3).getKind()).isEqualTo(YearBlock.KindEnum.LOWER);
        assertThat(after.getWarnings()).anySatisfy(n -> {
            assertThat(n.getCode()).isEqualTo(YearNote.CodeEnum.FOCUS_CONSECUTIVE);
            assertThat(n.getGroup()).isEqualTo(borrowed);
            assertThat(n.getOrdinal()).isEqualTo(3);
        });
    }

    @Test
    void patchFocusMoreThanTwo400() {
        owner();
        HttpHeaders auth = ownerAuthHeaders();
        YearPlan plan = create(auth);
        patchForBody(BLOCKS + at(plan, 1).getId(), Map.of("focus", List.of("chest", "back", "shoulder")), auth,
            HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void skipReturnsConsequenceAndSuggestion() {
        owner();
        HttpHeaders auth = ownerAuthHeaders();
        YearPlan plan = create(auth);
        YearBlock target = plan.getBlocks().stream()
            .filter(b -> b.getKind() != YearBlock.KindEnum.CONSOLIDATION && !b.getSkipConsequence().isEmpty())
            .findFirst().orElseThrow();
        String lost = target.getSkipConsequence().get(0);

        YearPlan after = patch(target.getId(), Map.of("skip", true), auth);

        assertThat(at(after, target.getOrdinal()).getStatus()).isEqualTo(YearBlock.StatusEnum.SKIPPED);
        assertThat(after.getFocusCount()).containsEntry(lost, 0);
        YearNote note = after.getWarnings().stream()
            .filter(n -> n.getCode() == YearNote.CodeEnum.NO_FOCUS_THIS_YEAR && lost.equals(n.getGroup()))
            .findFirst().orElseThrow();
        assertThat(note.getBlockId()).isNotNull();
        YearBlock suggested = after.getBlocks().stream().filter(b -> b.getId().equals(note.getBlockId()))
            .findFirst().orElseThrow();
        assertThat(note.getOrdinal()).isEqualTo(suggested.getOrdinal());
        assertThat(suggested.getKind()).isEqualTo(target.getKind());

        YearPlan back = patch(target.getId(), Map.of("skip", false), auth);
        assertThat(at(back, target.getOrdinal()).getStatus()).isEqualTo(YearBlock.StatusEnum.PLANNED);
    }

    @Test
    void shiftLaterThenEarlier() {
        owner();
        HttpHeaders auth = ownerAuthHeaders();
        YearPlan plan = create(auth);
        UUID id = at(plan, 3).getId();
        assertThat(at(plan, 3).getCanMoveEarlier()).isFalse();

        YearPlan later = patch(id, Map.of("shiftWeeks", 1), auth);
        assertThat(at(later, 3).getPlannedStart()).isEqualTo(START.plusWeeks(13));
        assertThat(at(later, 4).getPlannedStart()).isEqualTo(START.plusWeeks(19));
        assertThat(at(later, 3).getCanMoveEarlier()).isTrue();
        assertThat(later.getBufferWeeks()).isEqualTo(1);

        YearPlan earlier = patch(id, Map.of("shiftWeeks", -1), auth);
        assertThat(at(earlier, 3).getPlannedStart()).isEqualTo(START.plusWeeks(12));
        assertThat(at(earlier, 3).getCanMoveEarlier()).isFalse();
        assertThat(earlier.getBufferWeeks()).isEqualTo(2);

        patchForBody(BLOCKS + id, Map.of("shiftWeeks", -1), auth, HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void reorderSwapsCleanly() {
        owner();
        HttpHeaders auth = ownerAuthHeaders();
        YearPlan plan = create(auth);
        UUID second = at(plan, 2).getId();
        UUID third = at(plan, 3).getId();

        YearPlan after = patch(second, Map.of("ordinal", 3), auth);

        assertContiguous(after);
        assertThat(at(after, 3).getId()).isEqualTo(second);
        assertThat(at(after, 2).getId()).isEqualTo(third);
        assertThat(at(after, 2).getPlannedStart()).isEqualTo(START.plusWeeks(6));
        assertThat(at(after, 3).getPlannedStart()).isEqualTo(START.plusWeeks(12));
        assertContiguous(active(auth));
    }

    @Test
    void reorderTwiceInARow() {
        owner();
        HttpHeaders auth = ownerAuthHeaders();
        YearPlan plan = create(auth);
        UUID moved = at(plan, 2).getId();
        UUID first = at(plan, 1).getId();

        patch(moved, Map.of("ordinal", 5), auth);
        YearPlan after = patch(moved, Map.of("ordinal", 1), auth);

        assertContiguous(after);
        assertThat(at(after, 1).getId()).isEqualTo(moved);
        assertThat(at(after, 2).getId()).isEqualTo(first);
        assertThat(count("select count(distinct ordinal) from training_year_block where plan_id = ?", plan.getId()))
            .isEqualTo(9);
    }

    @Test
    void patchConsolidationOrdinal409() {
        owner();
        HttpHeaders auth = ownerAuthHeaders();
        YearPlan plan = create(auth);
        String body = patchForBody(BLOCKS + at(plan, 9).getId(), Map.of("ordinal", 1), auth, HttpStatus.CONFLICT,
            String.class);
        assertHasRequestError(body, "TRAIN_YEAR_BLOCK_LOCKED");
    }

    @Test
    void patchRunningBlock409() {
        UUID owner = owner();
        HttpHeaders auth = ownerAuthHeaders();
        runningMeso(owner);
        YearPlan plan = postForBody(PLANS, request(LocalDate.of(2026, 11, 23)), auth, HttpStatus.CREATED,
            YearPlan.class);

        String body = patchForBody(BLOCKS + at(plan, 1).getId(), Map.of("focus", List.of("ham")), auth,
            HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "TRAIN_YEAR_BLOCK_LOCKED");
    }

    @Test
    void createWhileBlockRunsAdoptsIt() {
        UUID owner = owner();
        HttpHeaders auth = ownerAuthHeaders();
        MesocycleEntity meso = runningMeso(owner);

        YearPlan plan = postForBody(PLANS, request(LocalDate.of(2026, 11, 23)), auth, HttpStatus.CREATED,
            YearPlan.class);

        assertThat(plan.getStartDate()).isEqualTo(LocalDate.of(2026, 11, 16));
        assertThat(plan.getCurrentWeek()).isEqualTo(1);
        YearBlock first = at(plan, 1);
        assertThat(first.getAdopted()).isTrue();
        assertThat(first.getStatus()).isEqualTo(YearBlock.StatusEnum.RUNNING);
        assertThat(first.getMesocycleId()).isEqualTo(meso.getId());
        assertThat(first.getFocus()).containsExactly("quad");
        assertThat(first.getKind()).isEqualTo(YearBlock.KindEnum.LOWER);
        assertThat(first.getPlannedStart()).isEqualTo(LocalDate.of(2026, 11, 16));
        assertThat(first.getCurrentWeek()).isEqualTo(1);
        assertThat(at(plan, 2).getKind()).isEqualTo(YearBlock.KindEnum.UPPER);
        assertThat(at(plan, 2).getPlannedStart()).isEqualTo(LocalDate.of(2026, 12, 28));
        assertThat(plan.getBlocks()).filteredOn(YearBlock::getAdopted).hasSize(1);
        assertContiguous(active(auth));
    }

    @Test
    void archive() {
        owner();
        HttpHeaders auth = ownerAuthHeaders();
        YearPlan plan = create(auth);

        YearPlan archived = postForBody(PLANS + "/" + plan.getId() + "/archive", null, auth, HttpStatus.OK,
            YearPlan.class);

        assertThat(archived.getStatus()).isEqualTo(YearPlan.StatusEnum.ARCHIVED);
        getForBody(PLANS + "/active", auth, HttpStatus.NOT_FOUND, String.class);
    }

    /** An active 6-week block started Monday 2026-11-16 with quad at Hangsúly. */
    private MesocycleEntity runningMeso(UUID owner) {
        MesocycleEntity m = trainPopulator.createMesocycle(owner, "Futó blokk", "active");
        m.setStartDate(LocalDate.of(2026, 11, 16));
        m.setEndDate(LocalDate.of(2026, 12, 27));
        m.setWeeks(6);
        m.setCurrentWeek(1);
        m.setMusclePriorities(Map.of("quad", "emphasize", "chest", "maintain"));
        return mesocycleRepository.saveAndFlush(m);
    }
}

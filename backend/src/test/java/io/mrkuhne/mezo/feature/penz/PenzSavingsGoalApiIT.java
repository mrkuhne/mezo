package io.mrkuhne.mezo.feature.penz;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PenzSavingsGoalRequest;
import io.mrkuhne.mezo.api.dto.PenzSavingsGoalResponse;
import io.mrkuhne.mezo.feature.penz.repository.PenzSavingsGoalRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.PenzPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Boop Pénz L5 (mezo-r36n9.103): /api/penz/savings-goals over HTTP — CRUD, ordering, client-ref idempotency,
 * soft delete, 404s, owner isolation and request validation. Amounts are invented.
 */
class PenzSavingsGoalApiIT extends ApiIntegrationTest {

    private static final String URL = "/api/penz/savings-goals";

    @Autowired private PenzPopulator penz;
    @Autowired private PenzSavingsGoalRepository goalRows;
    @Autowired private JdbcTemplate jdbc;

    private static PenzSavingsGoalRequest goal(String name, long targetMinor) {
        return new PenzSavingsGoalRequest().name(name).kind("goal").targetHufMinor(targetMinor);
    }

    @Test
    void testCreatePenzSavingsGoal_shouldStoreWithDefaultsAndAppend_whenCreatedWithoutOptionals() {
        RegisteredUser u = registerUser("penz goals create");
        PenzSavingsGoalResponse first = postForBody(URL, goal("Vésztartalék", 50_000_000L), u.headers(),
            HttpStatus.CREATED, PenzSavingsGoalResponse.class);
        assertThat(first.getId()).isNotNull();
        assertThat(first.getName()).isEqualTo("Vésztartalék");
        assertThat(first.getKind()).isEqualTo(PenzSavingsGoalResponse.KindEnum.GOAL);
        assertThat(first.getTarget().getMinor()).isEqualTo(50_000_000L);
        assertThat(first.getTarget().getHufMinor()).isEqualTo(50_000_000L);
        assertThat(first.getTarget().getCurrency()).isEqualTo("HUF");
        assertThat(first.getSaved().getMinor()).isZero();
        assertThat(first.getSaved().getCurrency()).isEqualTo("HUF");
        assertThat(first.getPosition()).isZero();
        assertThat(first.getDueDate()).isNull();
        assertThat(first.getNote()).isNull();
        assertThat(first.getClientRef()).isNull();

        PenzSavingsGoalResponse second = postForBody(URL, new PenzSavingsGoalRequest().name("  Új bicikli  ")
                .kind("purchase").targetHufMinor(35_000_000L).savedHufMinor(12_000_000L)
                .dueDate(LocalDate.of(2027, 5, 1)).note("Tavaszra"),
            u.headers(), HttpStatus.CREATED, PenzSavingsGoalResponse.class);
        assertThat(second.getName()).isEqualTo("Új bicikli");
        assertThat(second.getKind()).isEqualTo(PenzSavingsGoalResponse.KindEnum.PURCHASE);
        assertThat(second.getSaved().getHufMinor()).isEqualTo(12_000_000L);
        assertThat(second.getDueDate()).isEqualTo(LocalDate.of(2027, 5, 1));
        assertThat(second.getNote()).isEqualTo("Tavaszra");
        assertThat(second.getPosition()).isEqualTo(1);
    }

    @Test
    void testListPenzSavingsGoals_shouldOrderByPositionThenCreation_whenOwnerHasGoals() {
        RegisteredUser u = registerUser("penz goals list");
        penz.savingsGoal(u.id(), "Harmadik", "goal", 1_000_000L, 0L, 2);
        penz.savingsGoal(u.id(), "Első", "purchase", 2_000_000L, 500_000L, 0);
        penz.savingsGoal(u.id(), "Második A", "goal", 3_000_000L, 0L, 1);
        penz.savingsGoal(u.id(), "Második B", "goal", 4_000_000L, 0L, 1);

        List<PenzSavingsGoalResponse> list = getForList(URL, u.headers(), HttpStatus.OK,
            PenzSavingsGoalResponse.class);
        assertThat(list).extracting(PenzSavingsGoalResponse::getName)
            .containsExactly("Első", "Második A", "Második B", "Harmadik");

        // a new goal without a position lands at the end
        PenzSavingsGoalResponse appended = postForBody(URL, goal("Negyedik", 1_000_000L), u.headers(),
            HttpStatus.CREATED, PenzSavingsGoalResponse.class);
        assertThat(appended.getPosition()).isEqualTo(3);
    }

    @Test
    void testCreatePenzSavingsGoal_shouldReturnTheStoredRow_whenClientRefIsReplayed() {
        RegisteredUser u = registerUser("penz goals idempotent");
        UUID ref = UUID.randomUUID();
        PenzSavingsGoalResponse first = postForBody(URL, goal("Nyaralás", 40_000_000L).clientRef(ref), u.headers(),
            HttpStatus.CREATED, PenzSavingsGoalResponse.class);
        PenzSavingsGoalResponse replay = postForBody(URL, goal("Nyaralás más néven", 1L).clientRef(ref),
            u.headers(), HttpStatus.CREATED, PenzSavingsGoalResponse.class);
        assertThat(replay.getId()).isEqualTo(first.getId());
        assertThat(replay.getClientRef()).isEqualTo(ref);
        assertThat(replay.getName()).isEqualTo("Nyaralás");
        assertThat(getForList(URL, u.headers(), HttpStatus.OK, PenzSavingsGoalResponse.class)).hasSize(1);

        // another owner's equal client ref is its own row
        RegisteredUser other = registerUser("penz goals idempotent other");
        PenzSavingsGoalResponse theirs = postForBody(URL, goal("Nyaralás", 40_000_000L).clientRef(ref),
            other.headers(), HttpStatus.CREATED, PenzSavingsGoalResponse.class);
        assertThat(theirs.getId()).isNotEqualTo(first.getId());
    }

    @Test
    void testUpdatePenzSavingsGoal_shouldReplaceFieldsAndKeepPosition_whenPositionIsNull() {
        RegisteredUser u = registerUser("penz goals update");
        UUID ref = UUID.randomUUID();
        PenzSavingsGoalResponse created = postForBody(URL, goal("Laptop", 60_000_000L).clientRef(ref)
                .position(4).note("régi"),
            u.headers(), HttpStatus.CREATED, PenzSavingsGoalResponse.class);

        PenzSavingsGoalResponse updated = putForBody(URL + "/" + created.getId(), new PenzSavingsGoalRequest()
                .clientRef(UUID.randomUUID()).name("Új laptop").kind("purchase").targetHufMinor(55_000_000L)
                .savedHufMinor(20_000_000L).dueDate(LocalDate.of(2027, 1, 15)).note(" "),
            u.headers(), HttpStatus.OK, PenzSavingsGoalResponse.class);
        assertThat(updated.getId()).isEqualTo(created.getId());
        assertThat(updated.getName()).isEqualTo("Új laptop");
        assertThat(updated.getKind()).isEqualTo(PenzSavingsGoalResponse.KindEnum.PURCHASE);
        assertThat(updated.getTarget().getHufMinor()).isEqualTo(55_000_000L);
        assertThat(updated.getSaved().getHufMinor()).isEqualTo(20_000_000L);
        assertThat(updated.getDueDate()).isEqualTo(LocalDate.of(2027, 1, 15));
        assertThat(updated.getNote()).isNull();
        assertThat(updated.getPosition()).isEqualTo(4);
        assertThat(updated.getClientRef()).isEqualTo(ref); // ignored on update

        PenzSavingsGoalResponse moved = putForBody(URL + "/" + created.getId(),
            goal("Új laptop", 55_000_000L).position(0), u.headers(), HttpStatus.OK, PenzSavingsGoalResponse.class);
        assertThat(moved.getPosition()).isZero();
        assertThat(moved.getSaved().getHufMinor()).isZero(); // a null saved amount means 0
    }

    @Test
    void testDeletePenzSavingsGoal_shouldSoftDeleteAndThen404_whenDeleted() {
        RegisteredUser u = registerUser("penz goals delete");
        PenzSavingsGoalResponse created = postForBody(URL, goal("Autó", 300_000_000L), u.headers(),
            HttpStatus.CREATED, PenzSavingsGoalResponse.class);

        deleteAndExpect(URL + "/" + created.getId(), u.headers(), HttpStatus.NO_CONTENT);
        assertThat(getForList(URL, u.headers(), HttpStatus.OK, PenzSavingsGoalResponse.class)).isEmpty();
        // soft: the row survives with is_deleted = true, hidden from every finder
        assertThat(goalRows.findById(created.getId())).isEmpty();
        assertThat(jdbc.queryForObject("select is_deleted from penz_savings_goal where id = ?", Boolean.class,
            created.getId())).isTrue();

        String again = exchangeForBody(HttpMethod.DELETE, URL + "/" + created.getId(), null, u.headers(),
            HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(again, "PENZ_SAVINGS_GOAL_NOT_FOUND");
        String put = putForBody(URL + "/" + created.getId(), goal("Autó", 1L), u.headers(), HttpStatus.NOT_FOUND,
            String.class);
        assertHasRequestError(put, "PENZ_SAVINGS_GOAL_NOT_FOUND");
        String unknown = putForBody(URL + "/" + UUID.randomUUID(), goal("Semmi", 1L), u.headers(),
            HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(unknown, "PENZ_SAVINGS_GOAL_NOT_FOUND");
    }

    @Test
    void testPenzSavingsGoals_shouldBeInvisibleAndUntouchable_whenAnotherOwnerAsks() {
        RegisteredUser a = registerUser("penz goals owner a");
        RegisteredUser b = registerUser("penz goals owner b");
        PenzSavingsGoalResponse mine = postForBody(URL, goal("A célja", 10_000_000L), a.headers(),
            HttpStatus.CREATED, PenzSavingsGoalResponse.class);

        assertThat(getForList(URL, b.headers(), HttpStatus.OK, PenzSavingsGoalResponse.class)).isEmpty();
        String put = putForBody(URL + "/" + mine.getId(), goal("Lopott", 1L), b.headers(), HttpStatus.NOT_FOUND,
            String.class);
        assertHasRequestError(put, "PENZ_SAVINGS_GOAL_NOT_FOUND");
        deleteAndExpect(URL + "/" + mine.getId(), b.headers(), HttpStatus.NOT_FOUND);

        List<PenzSavingsGoalResponse> stillMine = getForList(URL, a.headers(), HttpStatus.OK,
            PenzSavingsGoalResponse.class);
        assertThat(stillMine).extracting(PenzSavingsGoalResponse::getName).containsExactly("A célja");
    }

    @Test
    void testCreatePenzSavingsGoal_shouldReturn400_whenRequestIsInvalid() {
        RegisteredUser u = registerUser("penz goals validation");
        String badKind = postForBody(URL, goal("Cél", 1_000_000L).kind("dream"), u.headers(),
            HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(badKind, "kind", "VALIDATION_INVALID_VALUE");

        postForBody(URL, goal("Cél", 0L), u.headers(), HttpStatus.BAD_REQUEST, String.class);
        postForBody(URL, goal("Cél", 1_000_000L).savedHufMinor(-1L), u.headers(), HttpStatus.BAD_REQUEST,
            String.class);
        postForBody(URL, goal("", 1_000_000L), u.headers(), HttpStatus.BAD_REQUEST, String.class);
        postForBody(URL, goal("x".repeat(81), 1_000_000L), u.headers(), HttpStatus.BAD_REQUEST, String.class);
        postForBody(URL, goal("Cél", 1_000_000L).note("x".repeat(501)), u.headers(), HttpStatus.BAD_REQUEST,
            String.class);
        postForBody(URL, goal("Cél", 1_000_000L).position(-1), u.headers(), HttpStatus.BAD_REQUEST, String.class);
        postForBody(URL, new PenzSavingsGoalRequest().kind("goal").targetHufMinor(1L), u.headers(),
            HttpStatus.BAD_REQUEST, String.class);
        String blank = postForBody(URL, goal("   ", 1_000_000L), u.headers(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(blank, "name", "VALIDATION_INVALID_VALUE");

        assertThat(getForList(URL, u.headers(), HttpStatus.OK, PenzSavingsGoalResponse.class)).isEmpty();
    }
}

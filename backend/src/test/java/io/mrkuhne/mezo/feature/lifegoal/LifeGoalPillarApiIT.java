package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LifeGoalPillarInput;
import io.mrkuhne.mezo.api.dto.LifeGoalPillarsRequest;
import io.mrkuhne.mezo.api.dto.LifeGoalResponse;
import io.mrkuhne.mezo.api.dto.PillarKind;
import io.mrkuhne.mezo.api.dto.PillarSource;
import io.mrkuhne.mezo.api.dto.SignalCatalogResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarDayRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.HabitPopulator;
import io.mrkuhne.mezo.support.populator.LifeGoalPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * HTTP-level IT for the {@code /api/life-goals/signals} catalog endpoint and for the habit-key
 * validation added in Task 4 to {@code LifeGoalPillarService.validate}.
 */
class LifeGoalPillarApiIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private HabitPopulator habitPopulator;
    @Autowired private LifeGoalPopulator lifeGoalPopulator;
    @Autowired private LifeGoalPillarDayRepository pillarDayRepository;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testListLifeGoalSignals_shouldReturnCatalog_whenCalled() {
        SignalCatalogResponse res = getForBody("/api/life-goals/signals", ownerAuthHeaders(), HttpStatus.OK, SignalCatalogResponse.class);
        // EXACTLY 28 — the catalog is closed (spec D4); a `>= 25` floor would let three entries
        // silently vanish, and every seeded/proposed pillar is validated against these rows.
        assertThat(res.getEntries()).hasSize(28);
        assertThat(res.getEntries()).anySatisfy(e -> {
            assertThat(e.getLabel()).isEqualTo("Alváshossz");
            assertThat(e.getKinds()).contains(PillarKind.AVERAGE);
        });
    }

    @Test
    void testReplacePillars_shouldReturn400_whenHabitKeyUnknown() {
        LifeGoalResponse g = postForBody("/api/life-goals", LifeGoalApiIT.kockahas(List.of(LifeGoalApiIT.sleepPillar())),
            ownerAuthHeaders(), HttpStatus.CREATED, LifeGoalResponse.class);
        LifeGoalPillarInput habit = LifeGoalPillarInput.builder().label("Fókuszblokk").skillKey("productivity").kind(PillarKind.HABIT)
            .source(PillarSource.builder().type(PillarSource.TypeEnum.HABIT).habitKey("no-such-habit").build()).build();
        ResponseEntity<String> res = exchangeForResponse(HttpMethod.PUT, "/api/life-goals/" + g.getId() + "/pillars",
            LifeGoalPillarsRequest.builder().pillars(List.of(habit)).build(), ownerAuthHeaders());
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasFieldError(res.getBody(), "pillars", "LIFE_GOAL_UNKNOWN_SIGNAL");
    }

    @Test
    void testReplacePillars_shouldAcceptPillar_whenHabitKeyKnown() {
        UUID owner = ownerId();
        List<io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity> defs = habitPopulator.pendingDay(owner, LocalDate.of(2026, 8, 20));
        String knownKey = defs.get(0).getHabitKey();

        LifeGoalResponse g = postForBody("/api/life-goals", LifeGoalApiIT.kockahas(List.of()),
            ownerAuthHeaders(), HttpStatus.CREATED, LifeGoalResponse.class);
        LifeGoalPillarInput habit = LifeGoalPillarInput.builder().label("Szokás").skillKey("productivity").kind(PillarKind.HABIT)
            .source(PillarSource.builder().type(PillarSource.TypeEnum.HABIT).habitKey(knownKey).build()).build();
        LifeGoalResponse res = putForBody("/api/life-goals/" + g.getId() + "/pillars",
            LifeGoalPillarsRequest.builder().pillars(List.of(habit)).build(), ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);
        assertThat(res.getPillars()).hasSize(1);
        assertThat(res.getPillars().get(0).getSource().getHabitKey()).isEqualTo(knownKey);
    }

    /**
     * The OpenAPI contract already caps {@code pillars} at {@code @Size(max = 5)} (matching
     * {@code mezo.lifegoal.max-pillars: 5}), so bean validation intercepts a 6-pillar request
     * before {@code LifeGoalPillarService.validate}'s own {@code LIFE_GOAL_TOO_MANY_PILLARS}
     * check ever runs — that service-side check is unreachable via HTTP as long as the two caps
     * match, and only guards direct/future callers of the service. This asserts the HTTP-visible
     * contract-validation error instead of the brief's (unreachable) service-level code.
     */
    @Test
    void testReplacePillars_shouldReturn400_whenSixPillars() {
        LifeGoalResponse g = postForBody("/api/life-goals", LifeGoalApiIT.kockahas(List.of()),
            ownerAuthHeaders(), HttpStatus.CREATED, LifeGoalResponse.class);
        List<LifeGoalPillarInput> six = java.util.Collections.nCopies(6, LifeGoalApiIT.sleepPillar());
        ResponseEntity<String> res = exchangeForResponse(HttpMethod.PUT, "/api/life-goals/" + g.getId() + "/pillars",
            LifeGoalPillarsRequest.builder().pillars(six).build(), ownerAuthHeaders());
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasFieldError(res.getBody(), "pillars", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testReplacePillars_shouldReplaceList_whenValid() {
        LifeGoalResponse g = postForBody("/api/life-goals", LifeGoalApiIT.kockahas(List.of(LifeGoalApiIT.sleepPillar())),
            ownerAuthHeaders(), HttpStatus.CREATED, LifeGoalResponse.class);
        LifeGoalPillarInput protein = LifeGoalPillarInput.builder().label("Fehérje").skillKey("cooking").kind(PillarKind.AVERAGE)
            .source(PillarSource.builder().type(PillarSource.TypeEnum.METRIC).key("DAILY_PROTEIN_G").build()).build();
        LifeGoalResponse res = putForBody("/api/life-goals/" + g.getId() + "/pillars",
            LifeGoalPillarsRequest.builder().pillars(List.of(protein, LifeGoalApiIT.sleepPillar())).build(),
            ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);
        assertThat(res.getPillars()).extracting(p -> p.getLabel()).containsExactly("Fehérje", "Alvás");
        assertThat(res.getPillars()).extracting(p -> p.getPosition()).containsExactly(0, 1);
    }

    /**
     * mezo-iizd.2 — the pillar-identity contract the scorer depends on: a replace that echoes an
     * existing pillar's id back UPDATES that row (new label/weight/position) instead of
     * soft-deleting it and inserting a fresh UUID. Without this a rename orphans the pillar's
     * whole life_goal_pillar_day history.
     */
    @Test
    void testReplacePillars_shouldKeepPillarId_whenIdEchoedBack() {
        LifeGoalResponse g = postForBody("/api/life-goals", LifeGoalApiIT.kockahas(List.of(LifeGoalApiIT.sleepPillar())),
            ownerAuthHeaders(), HttpStatus.CREATED, LifeGoalResponse.class);
        UUID pillarId = g.getPillars().get(0).getId();

        LifeGoalPillarInput renamed = LifeGoalApiIT.sleepPillar().id(pillarId).label("Alvás · 7 óra").weight(3);
        LifeGoalResponse res = putForBody("/api/life-goals/" + g.getId() + "/pillars",
            LifeGoalPillarsRequest.builder().pillars(List.of(renamed)).build(),
            ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);

        assertThat(res.getPillars()).hasSize(1);
        assertThat(res.getPillars().get(0).getId()).isEqualTo(pillarId);
        assertThat(res.getPillars().get(0).getLabel()).isEqualTo("Alvás · 7 óra");
        assertThat(res.getPillars().get(0).getWeight()).isEqualTo(3);
    }

    /** An id that is not one of THIS goal's live pillars is a 400 — never a silent new insert. */
    @Test
    void testReplacePillars_shouldReturn400_whenPillarIdUnknown() {
        LifeGoalResponse g = postForBody("/api/life-goals", LifeGoalApiIT.kockahas(List.of()),
            ownerAuthHeaders(), HttpStatus.CREATED, LifeGoalResponse.class);
        LifeGoalPillarInput alien = LifeGoalApiIT.sleepPillar().id(UUID.randomUUID());
        ResponseEntity<String> res = exchangeForResponse(HttpMethod.PUT, "/api/life-goals/" + g.getId() + "/pillars",
            LifeGoalPillarsRequest.builder().pillars(List.of(alien)).build(), ownerAuthHeaders());
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasFieldError(res.getBody(), "pillars", "LIFE_GOAL_UNKNOWN_PILLAR");
    }

    /** The same id twice in one list would make two rows fight over one identity — 400. */
    @Test
    void testReplacePillars_shouldReturn400_whenPillarIdRepeated() {
        LifeGoalResponse g = postForBody("/api/life-goals", LifeGoalApiIT.kockahas(List.of(LifeGoalApiIT.sleepPillar())),
            ownerAuthHeaders(), HttpStatus.CREATED, LifeGoalResponse.class);
        UUID pillarId = g.getPillars().get(0).getId();
        ResponseEntity<String> res = exchangeForResponse(HttpMethod.PUT, "/api/life-goals/" + g.getId() + "/pillars",
            LifeGoalPillarsRequest.builder()
                .pillars(List.of(LifeGoalApiIT.sleepPillar().id(pillarId), LifeGoalApiIT.sleepPillar().id(pillarId)))
                .build(),
            ownerAuthHeaders());
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasFieldError(res.getBody(), "pillars", "LIFE_GOAL_UNKNOWN_PILLAR");
    }

    /** A dropped pillar takes its day rows with it — no rows left dangling on a dead pillar. */
    @Test
    void testReplacePillars_shouldDeletePillarDays_whenPillarDropped() {
        UUID owner = ownerId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        LifeGoalPillarEntity pillar = lifeGoalPopulator.sleepPillar(goal);
        lifeGoalPopulator.pillarDay(pillar, LocalDate.of(2026, 8, 21), "hit");
        lifeGoalPopulator.pillarDay(pillar, LocalDate.of(2026, 8, 22), "miss");

        putForBody("/api/life-goals/" + goal.getId() + "/pillars",
            LifeGoalPillarsRequest.builder().pillars(List.of()).build(),
            ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);

        assertThat(pillarDayRepository.findByPillarIdInAndDeletedFalse(List.of(pillar.getId()))).isEmpty();
    }

    /** …and so does a kept pillar's history when the goal itself is deleted. */
    @Test
    void testDeleteLifeGoal_shouldDeletePillarDays_whenGoalHasHistory() {
        UUID owner = ownerId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        LifeGoalPillarEntity pillar = lifeGoalPopulator.sleepPillar(goal);
        lifeGoalPopulator.pillarDay(pillar, LocalDate.of(2026, 8, 21), "hit");

        deleteAndExpect("/api/life-goals/" + goal.getId(), ownerAuthHeaders(), HttpStatus.NO_CONTENT);

        assertThat(pillarDayRepository.findByPillarIdInAndDeletedFalse(List.of(pillar.getId()))).isEmpty();
    }

    /** A kept pillar keeps its history across a replace that only drops a SIBLING pillar. */
    @Test
    void testReplacePillars_shouldKeepPillarDays_whenPillarKeptById() {
        UUID owner = ownerId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        LifeGoalPillarEntity pillar = lifeGoalPopulator.sleepPillar(goal);
        lifeGoalPopulator.pillarDay(pillar, LocalDate.of(2026, 8, 21), "hit");

        putForBody("/api/life-goals/" + goal.getId() + "/pillars",
            LifeGoalPillarsRequest.builder().pillars(List.of(LifeGoalApiIT.sleepPillar().id(pillar.getId()))).build(),
            ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);

        assertThat(pillarDayRepository.findByPillarIdInAndDeletedFalse(List.of(pillar.getId()))).hasSize(1);
    }

    /** Same id, different signal: identity is kept but the now-incomparable history is dropped. */
    @Test
    void testReplacePillars_shouldDropPillarDays_whenSourceSwapped() {
        UUID owner = ownerId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        LifeGoalPillarEntity pillar = lifeGoalPopulator.sleepPillar(goal);
        lifeGoalPopulator.pillarDay(pillar, LocalDate.of(2026, 8, 21), "hit");

        LifeGoalPillarInput swapped = LifeGoalPillarInput.builder().label("Alvás").skillKey("recovery")
            .kind(PillarKind.AVERAGE).id(pillar.getId())
            .source(PillarSource.builder().type(PillarSource.TypeEnum.METRIC).key("DAILY_PROTEIN_G").build()).build();
        LifeGoalResponse res = putForBody("/api/life-goals/" + goal.getId() + "/pillars",
            LifeGoalPillarsRequest.builder().pillars(List.of(swapped)).build(),
            ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);

        assertThat(res.getPillars().get(0).getId()).isEqualTo(pillar.getId());
        assertThat(pillarDayRepository.findByPillarIdInAndDeletedFalse(List.of(pillar.getId()))).isEmpty();
    }
}

package io.mrkuhne.mezo.feature.season;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonAllowedRecipeEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.repository.SeasonAllowedRecipeRepository;
import io.mrkuhne.mezo.feature.season.repository.SeasonRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/** Boop B6 Évad S1 (mezo-r36n9.16): the season tables — one active season per owner, allowed recipes. */
@Transactional
class SeasonRepositoryIT extends AbstractIntegrationTest {

    @Autowired private SeasonRepository seasons;
    @Autowired private SeasonAllowedRecipeRepository allowed;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private GoalPopulator goalPopulator;

    @Test
    void secondActiveSeasonViolatesUniqueIndex() {
        UUID owner = databasePopulator.populateUser("s@test.local");
        seasons.saveAndFlush(season(owner, "active"));

        assertThatThrownBy(() -> seasons.saveAndFlush(season(owner, "active")))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void plannedSeasonsMayCoexistWithTheActiveOne() {
        UUID owner = databasePopulator.populateUser("s2@test.local");
        seasons.saveAndFlush(season(owner, "active"));
        seasons.saveAndFlush(season(owner, "planned"));

        assertThat(seasons.findActive(owner)).isPresent();
        assertThat(seasons.findByCreatedByAndDeletedFalseOrderByStartDateDesc(owner)).hasSize(2);
    }

    @Test
    void allowedRecipesRoundTrip() {
        UUID owner = databasePopulator.populateUser("s3@test.local");
        SeasonEntity s = seasons.saveAndFlush(season(owner, "planned"));
        List<UUID> ids = List.of(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());
        ids.forEach(id -> allowed.saveAndFlush(SeasonAllowedRecipeEntity.of(owner, s.getId(), id)));

        assertThat(allowed.findBySeasonId(s.getId()))
            .extracting(SeasonAllowedRecipeEntity::getRecipeId)
            .containsExactlyInAnyOrderElementsOf(ids);
    }

    private SeasonEntity season(UUID owner, String status) {
        GoalEntity goal = goalPopulator.createGoal(owner, "maintain", "planned");
        SeasonEntity s = new SeasonEntity();
        s.setCreatedBy(owner);
        s.setTitle("Őszi évad");
        s.setStatus(status);
        s.setStartDate(LocalDate.of(2026, 11, 23));
        s.setWeeks(8);
        s.setGoalId(goal.getId());
        return s;
    }
}

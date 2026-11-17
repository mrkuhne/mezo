package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalLineJson;
import io.mrkuhne.mezo.feature.train.repository.MesoWeekProposalRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

/** Storage of the weekly volume proposal (volume engine v2, spec §6.4). */
class MesoWeekProposalRepositoryIT extends AbstractIntegrationTest {

    @Autowired MesoWeekProposalRepository repository;
    @Autowired MesocycleRepository mesocycleRepository;
    @Autowired TrainPopulator train;
    @Autowired DatabasePopulator databasePopulator;

    @Test
    void aSecondWeeklyProposalForTheSameWeekIsRefused() {
        UUID user = databasePopulator.populateUser("proposal-a@test.local");
        MesocycleEntity meso = train.createActiveMeso(user);
        repository.saveAndFlush(proposal(user, meso.getId(), 2, "weekly", "pending"));

        assertThatThrownBy(() -> repository.saveAndFlush(proposal(user, meso.getId(), 2, "weekly", "pending")))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void aWeeklyAndATierChangeProposalCanShareAWeek() {
        UUID user = databasePopulator.populateUser("proposal-b@test.local");
        MesocycleEntity meso = train.createActiveMeso(user);
        repository.saveAndFlush(proposal(user, meso.getId(), 2, "weekly", "pending"));
        repository.saveAndFlush(proposal(user, meso.getId(), 2, "tier_change", "pending"));
        repository.saveAndFlush(proposal(user, meso.getId(), 2, "tier_change", "applied"));

        assertThat(repository.findWeekly(user, meso.getId(), 2)).isPresent();
    }

    @Test
    void linesRoundTrip() {
        UUID user = databasePopulator.populateUser("proposal-c@test.local");
        MesocycleEntity meso = train.createActiveMeso(user);
        UUID exerciseId = UUID.randomUUID();
        MesoWeekProposalEntity p = proposal(user, meso.getId(), 3, "weekly", "pending");
        p.setLines(List.of(new WeekProposalLineJson(
            "l1", exerciseId, "Row", 1, "back", "sets", 3, 4, List.of("under-band", "progress"), "accepted")));
        p.setPlanAfter(Map.of(exerciseId.toString(), 4));
        p.setRestore(Map.of(exerciseId.toString(), 3));
        repository.saveAndFlush(p);

        MesoWeekProposalEntity read = repository.findWeekly(user, meso.getId(), 3).orElseThrow();
        assertThat(read.getLines()).containsExactly(new WeekProposalLineJson(
            "l1", exerciseId, "Row", 1, "back", "sets", 3, 4, List.of("under-band", "progress"), "accepted"));
        assertThat(read.getPlanAfter()).containsEntry(exerciseId.toString(), 4);
        assertThat(read.getRestore()).containsEntry(exerciseId.toString(), 3);
        assertThat(read.getDecidedAt()).isNull();
    }

    @Test
    void findLatestAppliedSkipsPendingAndLaterWeeks() {
        UUID user = databasePopulator.populateUser("proposal-d@test.local");
        MesocycleEntity meso = train.createActiveMeso(user);
        repository.saveAndFlush(proposal(user, meso.getId(), 1, "weekly", "applied"));
        repository.saveAndFlush(proposal(user, meso.getId(), 2, "weekly", "auto_applied"));
        repository.saveAndFlush(proposal(user, meso.getId(), 3, "weekly", "pending"));
        repository.saveAndFlush(proposal(user, meso.getId(), 4, "weekly", "applied"));

        assertThat(repository.findLatestApplied(user, meso.getId(), 4).orElseThrow().getWeek()).isEqualTo(2);
        assertThat(repository.findLatestApplied(user, meso.getId(), 2).orElseThrow().getWeek()).isEqualTo(1);
        assertThat(repository.findLatestApplied(user, meso.getId(), 1)).isEmpty();
    }

    @Test
    void deletingTheRunDeletesItsProposals() {
        UUID user = databasePopulator.populateUser("proposal-e@test.local");
        MesocycleEntity meso = train.createActiveMeso(user);
        repository.saveAndFlush(proposal(user, meso.getId(), 2, "weekly", "pending"));

        // Physical delete: the FK is on delete cascade (the entity's soft delete would not cascade).
        mesocycleRepository.flush();
        jdbcDeleteMeso(meso.getId());

        assertThat(repository.count()).isZero();
    }

    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;

    private void jdbcDeleteMeso(UUID id) {
        jdbc.update("delete from mesocycle where id = ?", id);
    }

    private MesoWeekProposalEntity proposal(UUID user, UUID mesoId, int week, String kind, String status) {
        MesoWeekProposalEntity p = new MesoWeekProposalEntity();
        p.setCreatedBy(user);
        p.setMesocycleId(mesoId);
        p.setWeek(week);
        p.setKind(kind);
        p.setStatus(status);
        p.setLines(List.of());
        return p;
    }
}

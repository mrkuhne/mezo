package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.progression.entity.LevelUpEventEntity;
import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.entity.SkillProgressEntity;
import io.mrkuhne.mezo.feature.progression.repository.LevelUpEventRepository;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class ProgressionPersistenceIT extends AbstractIntegrationTest {

    @Autowired private SkillProgressRepository skillProgressRepository;
    @Autowired private LevelUpEventRepository levelUpEventRepository;
    @Autowired private DatabasePopulator databasePopulator;
    @PersistenceContext private EntityManager entityManager;

    @Test
    void testSaveSkillProgress_shouldRoundTrip_whenReloaded() {
        UUID user = databasePopulator.populateUser("prog@test.local");
        SkillProgressEntity row = new SkillProgressEntity();
        row.setCreatedBy(user);
        row.setSkillKey("anaerobic_capacity");
        row.setSkillKind("ATHLETIC");
        row.setCumulativeXp(303L);
        row.setCurrentLevel(3);
        SkillProgressEntity saved = skillProgressRepository.saveAndFlush(row);

        entityManager.clear();

        SkillProgressEntity reloaded = skillProgressRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getSkillKey()).isEqualTo("anaerobic_capacity");
        assertThat(reloaded.getCumulativeXp()).isEqualTo(303L);
        assertThat(reloaded.getCurrentLevel()).isEqualTo(3);
        assertThat(reloaded.getUpdatedAt()).isNotNull();
    }

    @Test
    void testSaveSkillProgress_shouldRejectDuplicate_whenSameCreatedByAndSkillKey() {
        UUID user = databasePopulator.populateUser("dup@test.local");
        SkillProgressEntity a = new SkillProgressEntity();
        a.setCreatedBy(user);
        a.setSkillKey("chest");
        a.setSkillKind("MUSCLE");
        skillProgressRepository.saveAndFlush(a);

        SkillProgressEntity b = new SkillProgressEntity();
        b.setCreatedBy(user);
        b.setSkillKey("chest");
        b.setSkillKind("MUSCLE");

        assertThatThrownBy(() -> skillProgressRepository.saveAndFlush(b))
            .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    @Test
    void testSaveLevelUpEvent_shouldRoundTripJsonbPayload_whenReloaded() {
        UUID user = databasePopulator.populateUser("evt@test.local");
        UUID workoutRef = UUID.randomUUID();
        LevelUpResult payload = new LevelUpResult(
            "GYM", "Klasszik kondi · Push", 58, 8, 480L,
            List.of(new LevelUpResult.Gain("max_strength", "ATHLETIC", "Maximális erő", null,
                120L, 6, 7, 70.0, 12.0)),
            List.of("max_strength"),
            List.of(new LevelUpResult.Perk("max_strength", "iron_core_2", "Vas-törzs II",
                "push-volumen tűrés +6%", 5)),
            new LevelUpResult.Robustness(25L, 5));

        LevelUpEventEntity evt = new LevelUpEventEntity();
        evt.setCreatedBy(user);
        evt.setSourceType("GYM");
        evt.setSourceRefId(workoutRef);
        evt.setTotalXp(480L);
        evt.setPayload(payload);
        LevelUpEventEntity saved = levelUpEventRepository.saveAndFlush(evt);

        entityManager.clear();

        LevelUpEventEntity reloaded = levelUpEventRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getPayload().source()).isEqualTo("GYM");
        assertThat(reloaded.getPayload().gains()).hasSize(1);
        assertThat(reloaded.getPayload().gains().get(0).skillKey()).isEqualTo("max_strength");
        assertThat(reloaded.getPayload().perks().get(0).name()).isEqualTo("Vas-törzs II");
        assertThat(reloaded.getPayload().robustness().streakWeeks()).isEqualTo(5);
    }

    @Test
    void testFindByCreatedByAndSourceRefId_shouldReturnEvent_whenIdempotencyKeyMatches() {
        UUID user = databasePopulator.populateUser("idem@test.local");
        UUID workoutRef = UUID.randomUUID();
        LevelUpEventEntity evt = new LevelUpEventEntity();
        evt.setCreatedBy(user);
        evt.setSourceType("RUN");
        evt.setSourceRefId(workoutRef);
        evt.setTotalXp(120L);
        evt.setPayload(new LevelUpResult("RUN", "Futás", 40, 6, 120L,
            List.of(), List.of(), List.of(), new LevelUpResult.Robustness(0L, 5)));
        levelUpEventRepository.saveAndFlush(evt);

        entityManager.clear();

        assertThat(levelUpEventRepository
            .findByCreatedByAndSourceTypeAndSourceRefId(user, "RUN", workoutRef)).isPresent();
    }
}

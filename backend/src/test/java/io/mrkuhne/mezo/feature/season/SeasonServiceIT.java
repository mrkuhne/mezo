package io.mrkuhne.mezo.feature.season;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalPlanLinkRepository;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.season.entity.SeasonDraftJson;
import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonRevisionEntity;
import io.mrkuhne.mezo.feature.season.port.SeasonSleepPort;
import io.mrkuhne.mezo.feature.season.port.SeasonTrainPort;
import io.mrkuhne.mezo.feature.season.repository.SeasonRepository;
import io.mrkuhne.mezo.feature.season.repository.SeasonRevisionRepository;
import io.mrkuhne.mezo.feature.season.service.FirstSeasonAssembler;
import io.mrkuhne.mezo.feature.season.service.SeasonPreviewService;
import io.mrkuhne.mezo.feature.season.service.SeasonService;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

/** Boop B6 Évad (mezo-r36n9.16): season lifecycle — create, activate, apply with fingerprint, the first draft. */
@Transactional
@Import(SeasonFixture.class)
class SeasonServiceIT extends AbstractIntegrationTest {

    @Autowired private SeasonService seasonService;
    @Autowired private SeasonPreviewService previewService;
    @Autowired private FirstSeasonAssembler firstSeasonAssembler;
    @Autowired private SeasonFixture fixture;
    @Autowired private SeasonRepository seasonRepository;
    @Autowired private SeasonRevisionRepository revisionRepository;
    @Autowired private SeasonTrainPort trainPort;
    @Autowired private SeasonSleepPort sleepPort;
    @Autowired private GoalRepository goalRepository;
    @Autowired private GoalPlanLinkRepository linkRepository;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private EntityManager em;

    @Test
    void activateWritesSlotsSleepAndLink() {
        UUID owner = fixture.owner("season-activate@test.local");
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        SeasonDraftJson d = withBlock(SeasonFixture.draft("cut", new BigDecimal("80.0"), null, List.of(0, 2, 4),
            SeasonFixture.SPORT), new SeasonDraftJson.Block("adopt", meso.getId(), null));

        SeasonEntity created = seasonService.create(owner, d);
        assertThat(created.getStatus()).isEqualTo("planned");
        SeasonEntity active = seasonService.activate(owner, created.getId());
        em.flush();

        assertThat(active.getStatus()).isEqualTo("active");
        assertThat(trainPort.currentSchedule(owner).gymDays()).containsExactly(0, 2, 4);
        assertThat(sleepPort.get(owner).targetMinutes()).isEqualTo(480); // 450 + 6×3 gym + 6×2 sport
        assertThat(sleepPort.get(owner).anchorTime()).isEqualTo("06:30");
        assertThat(active.getSleepNeedMin()).isEqualTo(480);
        assertThat(active.getSleepBaseMin()).isEqualTo(450);
        GoalEntity goal = goalRepository.findById(active.getGoalId()).orElseThrow();
        assertThat(goal.getStatus()).isEqualTo("active");
        assertThat(goal.getPrescription()).isNotNull();
        assertThat(linkRepository.findByGoalIdAndCreatedByAndDeletedFalseOrderByStartWeekAsc(goal.getId(), owner))
            .anyMatch(l -> l.getPlanId().equals(meso.getId()));
        assertThat(revisionRepository.findBySeasonIdOrderByCreatedAtAsc(active.getId())).hasSize(1);
    }

    @Test
    void activatingAnotherSeasonClosesThePreviousOne() {
        UUID owner = fixture.owner("season-activate-two@test.local");
        SeasonEntity first = seasonService.activate(owner, seasonService.create(owner, SeasonFixture.draft()).getId());
        SeasonEntity second = seasonService.activate(owner, seasonService.create(owner, SeasonFixture.draft()).getId());
        em.flush();

        assertThat(seasonRepository.findById(first.getId()).orElseThrow().getStatus()).isEqualTo("closed");
        assertThat(seasonRepository.findActive(owner)).map(SeasonEntity::getId).contains(second.getId());
        // The sleep base survives the hand-over: the need is not stacked on the previous season's need.
        assertThat(second.getSleepBaseMin()).isEqualTo(450);
    }

    @Test
    void applyWithStaleFingerprintIs409() {
        UUID owner = fixture.owner("season-stale@test.local");
        SeasonEntity s = seasonService.activate(owner, seasonService.create(owner, SeasonFixture.draft()).getId());
        SeasonDraftJson change = SeasonFixture.draft("cut", new BigDecimal("80.0"), null, List.of(0, 1, 2, 3, 4),
            SeasonFixture.SPORT);
        String fingerprint = previewService.preview(owner, s.getId(), change).fingerprint();

        weightLogPopulator.createWeightLog(owner, LocalDate.now(), new BigDecimal("83.4"));
        em.flush();

        assertThatThrownBy(() -> seasonService.apply(owner, s.getId(), change, fingerprint))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                e -> {
                    assertThat(e.getMessage()).isEqualTo("SEASON_PREVIEW_STALE");
                    assertThat(e.getStatus().value()).isEqualTo(409);
                });
    }

    @Test
    void applyWritesRevision() {
        UUID owner = fixture.owner("season-apply@test.local");
        SeasonEntity s = seasonService.activate(owner, seasonService.create(owner, SeasonFixture.draft()).getId());
        em.flush();
        SeasonDraftJson change = SeasonFixture.draft("cut", new BigDecimal("80.0"), null, List.of(0, 1, 2, 3, 4),
            SeasonFixture.SPORT);
        String fingerprint = previewService.preview(owner, s.getId(), change).fingerprint();

        SeasonEntity applied = seasonService.apply(owner, s.getId(), change, fingerprint);
        em.flush();

        List<SeasonRevisionEntity> revisions = revisionRepository.findBySeasonIdOrderByCreatedAtAsc(s.getId());
        assertThat(revisions).hasSize(2);
        SeasonRevisionEntity last = revisions.get(1);
        assertThat(last.getDraft().gymDays()).containsExactly(0, 1, 2, 3, 4);
        assertThat(last.getBefore().gymPerWeek()).isEqualTo(4);
        assertThat(last.getAfter().gymPerWeek()).isEqualTo(5);
        assertThat(trainPort.currentSchedule(owner).gymDays()).containsExactly(0, 1, 2, 3, 4);
        assertThat(sleepPort.get(owner).targetMinutes()).isEqualTo(492);
        assertThat(applied.getDraft().gymDays()).containsExactly(0, 1, 2, 3, 4);
    }

    @Test
    void firstDraftUsesLiveGoalOnly() {
        UUID owner = fixture.owner("season-first@test.local");
        GoalEntity deleted = goalPopulator.createGoal(owner, "cut", "active");
        deleted.setDeleted(true);
        goalRepository.saveAndFlush(deleted);
        GoalEntity live = goalPopulator.createGoal(owner, "maintain", "active");
        live.setTargetDate(LocalDate.now().plusWeeks(6));
        goalRepository.saveAndFlush(live);

        SeasonDraftJson d = firstSeasonAssembler.draft(owner);

        assertThat(d.trajectory()).isEqualTo("maintain");
        assertThat(d.title()).isEqualTo("Első évad");
        assertThat(d.targetWeightKg()).isNull();
        assertThat(d.gymDays()).containsExactly(0, 1, 3, 4);
        assertThat(d.sport()).hasSize(2);
        assertThat(d.sleepAnchor().time()).isEqualTo("06:30");
        assertThat(d.weeks()).isBetween(4, 24);
    }

    @Test
    void firstDraftCoversTheRunningBlockAndAdoptsIt() {
        UUID owner = fixture.owner("season-first-block@test.local");
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        meso.setEndDate(LocalDate.now().plusWeeks(9).minusDays(2));
        em.flush();

        SeasonDraftJson d = firstSeasonAssembler.draft(owner);

        assertThat(d.weeks()).isEqualTo(9);
        assertThat(d.block()).isEqualTo(new SeasonDraftJson.Block("adopt", meso.getId(), null));
    }

    private static SeasonDraftJson withBlock(SeasonDraftJson d, SeasonDraftJson.Block block) {
        return new SeasonDraftJson(d.title(), d.trajectory(), d.targetWeightKg(), d.ratePctPerWeek(), d.kgPerWeek(),
            d.startDate(), d.weeks(), d.gymDays(), d.gymTime(), d.sport(), d.sleepAnchor(), d.allowedRecipeIds(), block);
    }
}

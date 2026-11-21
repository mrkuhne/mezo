package io.mrkuhne.mezo.feature.season;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.fuel.entity.ProtocolEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonExperimentEntity;
import io.mrkuhne.mezo.feature.season.repository.SeasonExperimentRepository;
import io.mrkuhne.mezo.feature.season.repository.SeasonRepository;
import io.mrkuhne.mezo.feature.season.service.ExperimentService;
import io.mrkuhne.mezo.feature.season.service.SeasonContextRenderer;
import io.mrkuhne.mezo.feature.season.service.SeasonService;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.ProtocolPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

/** Boop B6 Évad S4 (mezo-r36n9.16): experiments — one at a time, Boop's one proposal, overlaps, kept habits. */
@Transactional
@Import(SeasonFixture.class)
class ExperimentServiceIT extends AbstractIntegrationTest {

    private static final LocalDate TODAY = LocalDate.now();

    @Autowired private SeasonFixture fixture;
    @Autowired private SeasonService seasonService;
    @Autowired private ExperimentService experimentService;
    @Autowired private SeasonExperimentRepository experimentRepository;
    @Autowired private SeasonRepository seasonRepository;
    @Autowired private SeasonContextRenderer renderer;
    @Autowired private MesocycleRepository mesocycleRepository;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private ProtocolPopulator protocolPopulator;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private io.mrkuhne.mezo.support.populator.MealPopulator mealPopulator;
    @Autowired private EntityManager em;

    private SeasonEntity season(UUID owner) {
        SeasonEntity s = seasonService.activate(owner, seasonService.create(owner, SeasonFixture.draft()).getId());
        em.flush();
        return s;
    }

    /** Moves a running experiment's start back, as if it had started {@code daysAgo} days ago. */
    private void startedDaysAgo(UUID id, int daysAgo) {
        SeasonExperimentEntity e = experimentRepository.findById(id).orElseThrow();
        e.setStartDate(TODAY.minusDays(daysAgo));
        experimentRepository.saveAndFlush(e);
    }

    private static int status(SystemRuntimeErrorException e) {
        return e.getStatus().value();
    }

    @Test
    void secondRunningIs409() {
        UUID owner = fixture.owner("exp-second@test.local");
        season(owner);
        ExperimentService.View first = experimentService.create(owner, "Esti magnézium", "supplement", null, null, TODAY);

        assertThat(first.experiment().getStatus()).isEqualTo("running");
        assertThat(first.experiment().getStartDate()).isEqualTo(TODAY);
        assertThat(first.dayIndex()).isEqualTo(1);
        assertThat(first.needDays()).isEqualTo(10);
        assertThat(first.watched()).hasSize(7);
        assertThatThrownBy(() -> experimentService.create(owner, "Hideg zuhany", "habit", null, 7, TODAY))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class, e -> {
                assertThat(status(e)).isEqualTo(409);
                assertThat(e.getMessage()).contains("EXPERIMENT_ALREADY_RUNNING");
            });
    }

    @Test
    void withoutActiveSeasonIs404() {
        UUID owner = fixture.owner("exp-noseason@test.local");

        assertThatThrownBy(() -> experimentService.list(owner, TODAY))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class, e -> assertThat(status(e)).isEqualTo(404));
    }

    @Test
    void atMostOneOpenProposal() {
        UUID owner = fixture.owner("exp-proposal@test.local");
        season(owner);
        PantryItemEntity old = pantryItemPopulator.createSupplement(owner, "D-vitamin");
        PantryItemEntity magnesium = pantryItemPopulator.createSupplement(owner, "Magnézium");
        PantryItemEntity zinc = pantryItemPopulator.createSupplement(owner, "Cink");
        ProtocolEntity p = protocolPopulator.createActiveProtocol(owner);
        protocolPopulator.createProtocolItemAt(owner, p.getId(), old.getId(), "breakfast", null,
            Instant.now().minus(30, ChronoUnit.DAYS));
        protocolPopulator.createProtocolItem(owner, p.getId(), magnesium.getId(), "evening", null);
        protocolPopulator.createProtocolItem(owner, p.getId(), zinc.getId(), "evening", null);

        ExperimentService.Listing first = experimentService.list(owner, TODAY);
        experimentService.daily(owner, TODAY);
        ExperimentService.Listing again = experimentService.list(owner, TODAY);

        assertThat(first.proposal()).isNotNull();
        SeasonExperimentEntity proposal = first.proposal().experiment();
        assertThat(proposal.getSubjectKind()).isEqualTo("supplement");
        assertThat(proposal.getSubjectRef()).isIn(magnesium.getId(), zinc.getId());
        assertThat(proposal.getStartDate()).isNull();
        assertThat(proposal.getReason()).startsWith("Ma került a napi étrend-kiegészítőid közé: ").endsWith(".");
        assertThat(again.proposal().experiment().getId()).isEqualTo(proposal.getId());
        assertThat(experimentRepository.findByCreatedByAndStatus(owner, "proposed")).hasSize(1);

        // dismissing it lets the next candidate in — never the dismissed subject again
        experimentService.dismiss(owner, proposal.getId(), TODAY);
        ExperimentService.Listing next = experimentService.list(owner, TODAY);
        assertThat(next.proposal()).isNotNull();
        assertThat(next.proposal().experiment().getSubjectRef()).isNotEqualTo(proposal.getSubjectRef())
            .isNotEqualTo(old.getId());

        // a proposal starts from today; a running one blocks new proposals
        ExperimentService.View started = experimentService.start(owner, next.proposal().experiment().getId(), TODAY);
        assertThat(started.experiment().getStatus()).isEqualTo("running");
        assertThatThrownBy(() -> experimentService.start(owner, started.experiment().getId(), TODAY))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                e -> assertThat(e.getMessage()).contains("EXPERIMENT_NOT_PROPOSED"));
        journalPopulator.createEntry(owner, TODAY, "Mostantól minden reggel sétálok.", "boop");
        assertThat(experimentService.list(owner, TODAY).proposal()).isNull();
    }

    @Test
    void journalLineBecomesAProposal() {
        UUID owner = fixture.owner("exp-journal@test.local");
        season(owner);
        journalPopulator.createEntry(owner, TODAY.minusDays(1), "Jó nap volt. Elkezdtem esténként olvasni lefekvés előtt!",
            "boop");

        ExperimentService.Listing l = experimentService.list(owner, TODAY);

        assertThat(l.proposal()).isNotNull();
        assertThat(l.proposal().experiment().getSubjectKind()).isEqualTo("text");
        assertThat(l.proposal().experiment().getSubjectRef()).isNull();
        assertThat(l.proposal().experiment().getTitle()).isEqualTo("Elkezdtem esténként olvasni lefekvés előtt");
    }

    @Test
    void foodFirstEatenAndAgainWithinAWeekBecomesAProposal() {
        UUID owner = fixture.owner("exp-food@test.local");
        season(owner);
        PantryItemEntity oldFood = pantryItemPopulator.createFood(owner, "Zabpehely", null);
        PantryItemEntity kefir = pantryItemPopulator.createFood(owner, "Kefir", null);
        mealPopulator.createPantryMeal(owner, oldFood, TODAY.minusDays(30));
        mealPopulator.createPantryMeal(owner, oldFood, TODAY.minusDays(1));
        mealPopulator.createPantryMeal(owner, kefir, TODAY.minusDays(5));
        mealPopulator.createPantryMeal(owner, kefir, TODAY.minusDays(1));

        ExperimentService.Listing l = experimentService.list(owner, TODAY);

        assertThat(l.proposal()).isNotNull();
        assertThat(l.proposal().experiment().getSubjectKind()).isEqualTo("food");
        assertThat(l.proposal().experiment().getSubjectRef()).isEqualTo(kefir.getId());
        assertThat(l.proposal().experiment().getTitle()).isEqualTo("Kefir");
    }

    @Test
    void proposeOffSettingSilencesDetector() {
        UUID owner = fixture.owner("exp-off@test.local");
        SeasonEntity s = season(owner);
        s = seasonRepository.findById(s.getId()).orElseThrow();
        s.setProposeExperiments(false);
        seasonRepository.saveAndFlush(s);
        journalPopulator.createEntry(owner, TODAY, "Mostantól minden reggel sétálok.", "boop");
        PantryItemEntity magnesium = pantryItemPopulator.createSupplement(owner, "Magnézium");
        ProtocolEntity p = protocolPopulator.createActiveProtocol(owner);
        protocolPopulator.createProtocolItem(owner, p.getId(), magnesium.getId(), "evening", null);

        ExperimentService.Listing l = experimentService.list(owner, TODAY);
        experimentService.daily(owner, TODAY);

        assertThat(l.proposal()).isNull();
        assertThat(l.proposeOn()).isFalse();
        assertThat(experimentRepository.findByCreatedByAndStatus(owner, "proposed")).isEmpty();
    }

    @Test
    void overlapFlaggedWhenMesocycleStartsInWindow() {
        UUID owner = fixture.owner("exp-overlap@test.local");
        season(owner);
        UUID id = experimentService.create(owner, "Esti magnézium", "habit", null, 14, TODAY).experiment().getId();
        startedDaysAgo(id, 5);
        MesocycleEntity m = trainPopulator.createMesocycle(owner, "Erő blokk", "archived");
        m.setStartDate(TODAY.minusDays(2));
        m.setEndDate(TODAY.plusWeeks(6));
        mesocycleRepository.saveAndFlush(m);

        ExperimentService.View running = experimentService.list(owner, TODAY).running();

        assertThat(running.dayIndex()).isEqualTo(6);
        assertThat(running.overlaps()).extracting(o -> o.kind() + "|" + o.date() + "|" + o.text())
            .containsExactly("mesocycle|" + TODAY.minusDays(2) + "|Közben új edzésblokk indult");

        // finished: the overlap is carried into the stored result
        startedDaysAgo(id, 15); // window today-15 .. today-2 — the block start is its last day
        ExperimentService.Listing done = experimentService.list(owner, TODAY);
        assertThat(done.running()).isNull();
        assertThat(done.past()).hasSize(1);
        SeasonExperimentEntity e = done.past().get(0).experiment();
        assertThat(e.getStatus()).isEqualTo("done");
        assertThat(e.getFinishedOn()).isEqualTo(TODAY.minusDays(1));
        assertThat(e.getResult().verdict()).isEqualTo("insufficient");
        assertThat(e.getResult().baselineFrom()).isEqualTo(TODAY.minusDays(29));
        assertThat(e.getResult().baselineTo()).isEqualTo(TODAY.minusDays(16));
        assertThat(e.getResult().signalsOrEmpty()).hasSize(7);
        assertThat(done.past().get(0).overlaps()).extracting(o -> o.kind()).containsExactly("mesocycle");
    }

    @Test
    void markOutsideWindowIs400() {
        UUID owner = fixture.owner("exp-mark@test.local");
        season(owner);
        UUID id = experimentService.create(owner, "Esti magnézium", "habit", null, 14, TODAY).experiment().getId();
        startedDaysAgo(id, 2);

        ExperimentService.View marked = experimentService.markDay(owner, id, TODAY.minusDays(1), true, TODAY);
        assertThat(marked.experiment().getMarkedDays()).containsExactly(TODAY.minusDays(1));
        experimentService.markDay(owner, id, TODAY, true, TODAY);
        ExperimentService.View unmarked = experimentService.markDay(owner, id, TODAY.minusDays(1), false, TODAY);
        assertThat(unmarked.experiment().getMarkedDays()).containsExactly(TODAY);

        for (LocalDate outside : List.of(TODAY.plusDays(1), TODAY.minusDays(3))) {
            assertThatThrownBy(() -> experimentService.markDay(owner, id, outside, true, TODAY))
                .isInstanceOfSatisfying(SystemRuntimeErrorException.class, e -> {
                    assertThat(status(e)).isEqualTo(400);
                    assertThat(e.getMessage()).contains("EXPERIMENT_DAY_OUTSIDE");
                });
        }
        experimentService.dismiss(owner, id, TODAY);
        assertThatThrownBy(() -> experimentService.markDay(owner, id, TODAY, true, TODAY))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                e -> assertThat(e.getMessage()).contains("EXPERIMENT_NOT_RUNNING"));
    }

    @Test
    void keepAddsRuleToContext() {
        UUID owner = fixture.owner("exp-keep@test.local");
        season(owner);
        UUID id = experimentService.create(owner, "Esti magnézium", "supplement", null, 14, TODAY).experiment().getId();
        assertThat(renderer.render(owner, TODAY)).contains("[Évad] Kísérlet fut: Esti magnézium (1. nap / 14)");
        assertThatThrownBy(() -> experimentService.keep(owner, id, TODAY))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                e -> assertThat(e.getMessage()).contains("EXPERIMENT_NOT_DONE"));
        startedDaysAgo(id, 15);
        experimentService.list(owner, TODAY);

        ExperimentService.View kept = experimentService.keep(owner, id, TODAY);
        experimentService.keep(owner, id, TODAY); // idempotent

        assertThat(kept.experiment().isKept()).isTrue();
        String context = renderer.render(owner, TODAY);
        assertThat(context).contains("[Évad] Szokás (kísérletből megtartva): Esti magnézium")
            .doesNotContain("Kísérlet fut");
    }

    @Test
    void finishComparesSignals() {
        UUID owner = fixture.owner("exp-signals@test.local");
        season(owner);
        UUID id = experimentService.create(owner, "Korábbi lefekvés", "habit", null, 7, TODAY).experiment().getId();
        startedDaysAgo(id, 7);
        SeasonExperimentEntity e = experimentRepository.findById(id).orElseThrow();
        java.util.List<LocalDate> days = new java.util.ArrayList<>();
        for (int i = 7; i >= 1; i--) {
            days.add(TODAY.minusDays(i));
        }
        e.setMarkedDays(days);
        experimentRepository.saveAndFlush(e);
        for (int i = 1; i <= 14; i++) {
            // invented: 6 h a night before the window, 7 h 30 inside it
            sleepLogPopulator.createSleepLog(owner, TODAY.minusDays(i), i <= 7 ? new java.math.BigDecimal("7.5")
                : new java.math.BigDecimal("6.0"), 3);
        }

        SeasonExperimentEntity done = experimentService.list(owner, TODAY).past().get(0).experiment();

        assertThat(done.getResult().verdict()).isEqualTo("clear");
        assertThat(done.getResult().markedCount()).isEqualTo(7);
        var sleep = done.getResult().signalsOrEmpty().stream().filter(s -> s.key().equals("sleep_min")).findFirst()
            .orElseThrow();
        assertThat(sleep.before()).isEqualTo(360.0);
        assertThat(sleep.after()).isEqualTo(450.0);
        assertThat(sleep.cliffsDelta()).isEqualTo(1.0);
        assertThat(sleep.better()).isTrue();
    }
}

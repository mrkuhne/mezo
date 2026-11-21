package io.mrkuhne.mezo.feature.season;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.SeasonOverview;
import io.mrkuhne.mezo.api.dto.SeasonResponse;
import io.mrkuhne.mezo.api.dto.SeasonUpcoming;
import io.mrkuhne.mezo.feature.season.entity.SeasonDraftJson;
import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.repository.SeasonRepository;
import io.mrkuhne.mezo.feature.season.service.SeasonService;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.MesoTemplatePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Éves terv (mezo-r36n9.113 Task 7): a newly started block becomes the season's block — the goal gets a newer
 * {@code goal_plan_link} (old links stay as history) and the season draft's block becomes {@code adopt <new>}, after
 * the start commits. The season (block A, 5 weeks, deload in its week 5) started two weeks ago, so a block B started
 * today sits in season week 3. All values invented.
 */
@Import(SeasonFixture.class)
class SeasonBlockRelinkIT extends ApiIntegrationTest {

    private static final String TEMPLATES = "/api/train/meso-templates/";

    @Autowired private SeasonFixture fixture;
    @Autowired private SeasonService seasonService;
    @Autowired private SeasonRepository seasonRepository;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private MesoTemplatePopulator templatePopulator;
    @Autowired private MesocycleRepository mesocycleRepository;
    @Autowired private JdbcTemplate jdbc;

    private record Setup(RegisteredUser user, SeasonEntity season, MesocycleEntity blockA) {
    }

    /** An active season that started two weeks ago with block A (started with it) as its block. */
    private Setup activeSeasonWithBlockA(String label) {
        RegisteredUser u = registerUser(label);
        UUID owner = fixture.owner(u.email());
        MesocycleEntity a = trainPopulator.activeMesoStartedWeeksAgo(owner, 2, 5,
            List.of("MEV", "MAV", "MRV", "MRV", "Deload"));
        SeasonDraftJson d = SeasonFixture.draft();
        SeasonEntity created = seasonService.create(owner, new SeasonDraftJson(d.title(), d.trajectory(),
            d.targetWeightKg(), null, null, LocalDate.now().minusWeeks(2), d.weeks(), d.gymDays(), d.gymTime(),
            d.sport(), d.sleepAnchor(), d.allowedRecipeIds(), new SeasonDraftJson.Block("adopt", a.getId(), null)));
        SeasonEntity active = seasonService.activate(owner, created.getId());
        return new Setup(u, active, a);
    }

    private MesocycleResponse startTemplate(UUID owner, HttpHeaders auth) {
        UUID template = templatePopulator.template(owner).getId(); // 4 weeks: MEV, MAV, MRV, Deload
        return postForBody(TEMPLATES + template + "/start",
            Map.of("startDate", LocalDate.now().toString(), "status", "active"), auth, HttpStatus.OK,
            MesocycleResponse.class);
    }

    private SeasonOverview overview(HttpHeaders auth) {
        return getForBody("/api/seasons/active/overview", auth, HttpStatus.OK, SeasonOverview.class);
    }

    private int links(UUID mesoId) {
        return jdbc.queryForObject("select count(*) from goal_plan_link where plan_id = ? and is_deleted = false",
            Integer.class, mesoId);
    }

    @Test
    void newBlockBecomesSeasonBlock() {
        Setup s = activeSeasonWithBlockA("RelinkNew");
        HttpHeaders auth = s.user().headers();
        SeasonOverview before = overview(auth);
        assertThat(before.getPillars().getBlock().getMesocycleId()).isEqualTo(s.blockA().getId());

        MesocycleResponse b = startTemplate(s.user().id(), auth);

        SeasonOverview after = overview(auth);
        assertThat(after.getPillars().getBlock().getMesocycleId()).isEqualTo(b.getId());
        assertThat(after.getPillars().getBlock().getFromWeek()).isEqualTo(3);
        assertThat(after.getSeason().getId()).isEqualTo(s.season().getId());
        assertThat(after.getSeason().getGoalId()).isEqualTo(before.getSeason().getGoalId());
        assertThat(after.getSeason().getTitle()).isEqualTo(before.getSeason().getTitle());
        assertThat(after.getPillars().getFood().getTrainDayKcal()).isEqualTo(before.getPillars().getFood().getTrainDayKcal());
        assertThat(seasonRepository.findById(s.season().getId()).orElseThrow().getDraft().block())
            .isEqualTo(new SeasonDraftJson.Block("adopt", b.getId(), null));
        assertThat(links(s.blockA().getId())).isEqualTo(1); // A's link stays as history
        assertThat(links(b.getId())).isEqualTo(1);
    }

    @Test
    void deloadWeeksFollowNewBlock() {
        Setup s = activeSeasonWithBlockA("RelinkDeload");
        HttpHeaders auth = s.user().headers();
        assertThat(overview(auth).getUpcoming()).filteredOn(u -> u.getKind() == SeasonUpcoming.KindEnum.DELOAD)
            .extracting(SeasonUpcoming::getWeek).containsExactly(5);

        startTemplate(s.user().id(), auth);

        // B starts in season week 3; its deload is its week 4 → season week 6
        assertThat(overview(auth).getUpcoming()).filteredOn(u -> u.getKind() == SeasonUpcoming.KindEnum.DELOAD)
            .extracting(SeasonUpcoming::getWeek).containsExactly(6);
    }

    @Test
    void noSeasonNoLink() {
        RegisteredUser u = registerUser("RelinkNone");
        UUID owner = fixture.owner(u.email());

        MesocycleResponse b = startTemplate(owner, u.headers());

        assertThat(mesocycleRepository.findById(b.getId())).isPresent();
        assertThat(links(b.getId())).isZero();
    }

    @Test
    void seasonActivationStartDoesNotDoubleLink() {
        RegisteredUser u = registerUser("RelinkActivation");
        UUID owner = fixture.owner(u.email());
        UUID template = templatePopulator.template(owner).getId();
        SeasonDraftJson d = SeasonFixture.draft();
        SeasonEntity created = seasonService.create(owner, new SeasonDraftJson(d.title(), d.trajectory(),
            d.targetWeightKg(), null, null, d.startDate(), d.weeks(), d.gymDays(), d.gymTime(), d.sport(),
            d.sleepAnchor(), d.allowedRecipeIds(), new SeasonDraftJson.Block("template", null, template)));

        seasonService.activate(owner, created.getId());

        UUID run = mesocycleRepository.findByCreatedByAndStatusAndDeletedFalse(owner, "active").get(0).getId();
        assertThat(links(run)).isEqualTo(1);
        assertThat(seasonRepository.findById(created.getId()).orElseThrow().getDraft().block())
            .isEqualTo(new SeasonDraftJson.Block("adopt", run, null));
    }

    @Test
    void discardedNewestFallsBackToPrevious() {
        Setup s = activeSeasonWithBlockA("RelinkDiscard");
        HttpHeaders auth = s.user().headers();
        MesocycleResponse b = startTemplate(s.user().id(), auth);
        assertThat(getForList("/api/seasons", auth, HttpStatus.OK, SeasonResponse.class).get(0).getMesocycleId())
            .isEqualTo(b.getId());

        postForBody("/api/train/mesocycles/" + b.getId() + "/discard", null, auth, HttpStatus.NO_CONTENT, String.class);

        assertThat(getForList("/api/seasons", auth, HttpStatus.OK, SeasonResponse.class).get(0).getMesocycleId())
            .isEqualTo(s.blockA().getId());
        assertThat(overview(auth).getPillars().getBlock().getMesocycleId()).isEqualTo(s.blockA().getId());
    }

    @Test
    void plannedBlockStartingOnItsDayBecomesSeasonBlock() {
        Setup s = activeSeasonWithBlockA("RelinkPlanned");
        // a planned block due today that no stamp linked (written straight to the table, no start event)
        MesocycleEntity b = trainPopulator.createMesocycle(s.user().id(), "Tervezett B", "planned");
        b.setStartDate(LocalDate.now());
        b.setEndDate(LocalDate.now().plusWeeks(6));
        mesocycleRepository.saveAndFlush(b);

        getForBody("/api/train/year-plans/active", s.user().headers(), HttpStatus.NOT_FOUND, String.class);

        assertThat(mesocycleRepository.findById(b.getId()).orElseThrow().getStatus()).isEqualTo("active");
        assertThat(overview(s.user().headers()).getPillars().getBlock().getMesocycleId()).isEqualTo(b.getId());
    }

    @Test
    void failedSeasonLinkNeverFailsTheStart() {
        Setup s = activeSeasonWithBlockA("RelinkFails");
        // the season's goal is gone, so linking the new block throws — the start must still succeed
        jdbc.update("update goal set is_deleted = true where id = ?", s.season().getGoalId());

        MesocycleResponse b = startTemplate(s.user().id(), s.user().headers());

        assertThat(mesocycleRepository.findById(b.getId()).orElseThrow().getStatus()).isEqualTo("active");
        assertThat(links(b.getId())).isZero();
    }
}

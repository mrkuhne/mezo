package io.mrkuhne.mezo.feature.season;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SeasonExperiment;
import io.mrkuhne.mezo.api.dto.SeasonExperimentCreate;
import io.mrkuhne.mezo.api.dto.SeasonExperimentMark;
import io.mrkuhne.mezo.api.dto.SeasonExperiments;
import io.mrkuhne.mezo.feature.season.service.SeasonService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;

/** Boop B6 Évad S4 (mezo-r36n9.16): the Hatás tab over HTTP — list → create → mark → dismiss. */
@Import(SeasonFixture.class)
class ExperimentApiIT extends ApiIntegrationTest {

    @Autowired private SeasonFixture fixture;
    @Autowired private SeasonService seasonService;

    @Test
    void experimentRoundTrip() {
        RegisteredUser u = registerUser("Experiment");
        UUID owner = u.id();
        fixture.owner(u.email());
        getForBody("/api/seasons/experiments", u.headers(), HttpStatus.NOT_FOUND, String.class);
        seasonService.activate(owner, seasonService.create(owner, SeasonFixture.draft()).getId());
        LocalDate today = LocalDate.now();

        SeasonExperiments empty = getForBody("/api/seasons/experiments", u.headers(), HttpStatus.OK, SeasonExperiments.class);
        assertThat(empty.getProposal()).isNull();
        assertThat(empty.getRunning()).isNull();
        assertThat(empty.getPast()).isEmpty();
        assertThat(empty.getProposeOn()).isTrue();

        SeasonExperiment created = postForBody("/api/seasons/experiments",
            SeasonExperimentCreate.builder().title("Esti magnézium").lengthDays(14).build(), u.headers(), HttpStatus.OK,
            SeasonExperiment.class);
        assertThat(created.getStatus()).isEqualTo(SeasonExperiment.StatusEnum.RUNNING);
        assertThat(created.getSubjectKind()).isEqualTo(SeasonExperiment.SubjectKindEnum.HABIT);
        assertThat(created.getStartDate()).isEqualTo(today);
        assertThat(created.getEndDate()).isEqualTo(today.plusDays(13));
        assertThat(created.getDayIndex()).isEqualTo(1);
        assertThat(created.getNeedDays()).isEqualTo(10);
        assertThat(created.getWatched()).hasSize(7);
        assertThat(created.getResult()).isNull();
        String second = postForBody("/api/seasons/experiments", SeasonExperimentCreate.builder().title("Másik").build(),
            u.headers(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(second, "EXPERIMENT_ALREADY_RUNNING");

        SeasonExperiment marked = putForBody("/api/seasons/experiments/" + created.getId() + "/days",
            SeasonExperimentMark.builder().date(today).done(true).build(), u.headers(), HttpStatus.OK, SeasonExperiment.class);
        assertThat(marked.getMarkedDays()).containsExactly(today);
        String outside = putForBody("/api/seasons/experiments/" + created.getId() + "/days",
            SeasonExperimentMark.builder().date(today.plusDays(1)).done(true).build(), u.headers(), HttpStatus.BAD_REQUEST,
            String.class);
        assertHasRequestError(outside, "EXPERIMENT_DAY_OUTSIDE");

        SeasonExperiments listed = getForBody("/api/seasons/experiments", u.headers(), HttpStatus.OK, SeasonExperiments.class);
        assertThat(listed.getRunning().getId()).isEqualTo(created.getId());

        SeasonExperiment dismissed = postForBody("/api/seasons/experiments/" + created.getId() + "/dismiss", null,
            u.headers(), HttpStatus.OK, SeasonExperiment.class);
        assertThat(dismissed.getStatus()).isEqualTo(SeasonExperiment.StatusEnum.DISMISSED);
        postForBody("/api/seasons/experiments/" + created.getId() + "/dismiss", null, u.headers(), HttpStatus.OK,
            SeasonExperiment.class);
        String keep = postForBody("/api/seasons/experiments/" + created.getId() + "/keep", null, u.headers(),
            HttpStatus.CONFLICT, String.class);
        assertHasRequestError(keep, "EXPERIMENT_NOT_DONE");
        postForBody("/api/seasons/experiments/" + UUID.randomUUID() + "/start", null, u.headers(), HttpStatus.NOT_FOUND,
            String.class);

        SeasonExperiments after = getForBody("/api/seasons/experiments", u.headers(), HttpStatus.OK, SeasonExperiments.class);
        assertThat(after.getRunning()).isNull();
        assertThat(after.getPast()).isEmpty();
    }
}

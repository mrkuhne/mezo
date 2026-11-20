package io.mrkuhne.mezo.feature.season;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SeasonApply;
import io.mrkuhne.mezo.api.dto.SeasonDraft;
import io.mrkuhne.mezo.api.dto.SeasonOverview;
import io.mrkuhne.mezo.api.dto.SeasonPreview;
import io.mrkuhne.mezo.api.dto.SeasonResponse;
import io.mrkuhne.mezo.api.dto.SeasonRules;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;

/** Boop B6 Évad (mezo-r36n9.16): the season API end to end over HTTP. All numbers invented. */
@Import(SeasonFixture.class)
class SeasonApiIT extends ApiIntegrationTest {

    @Autowired private SeasonFixture fixture;
    @Autowired private io.mrkuhne.mezo.support.populator.GoalPopulator goalPopulator;

    @Test
    void fullFlow() {
        RegisteredUser u = registerUser("Evad");
        fixture.owner(u.email());

        getForBody("/api/seasons/active/overview", u.headers(), HttpStatus.NOT_FOUND, String.class);

        SeasonDraft draft = getForBody("/api/seasons/draft", u.headers(), HttpStatus.OK, SeasonDraft.class);
        assertThat(draft.getTitle()).isEqualTo("Első évad");
        assertThat(draft.getTrajectory()).isEqualTo(SeasonDraft.TrajectoryEnum.MAINTAIN);
        assertThat(draft.getGymDays()).containsExactly(0, 1, 3, 4);

        draft.setTrajectory(SeasonDraft.TrajectoryEnum.CUT);
        draft.setTargetWeightKg(new BigDecimal("80.0"));
        SeasonPreview wizard = postForBody("/api/seasons/draft/preview", draft, u.headers(), HttpStatus.OK,
            SeasonPreview.class);
        assertThat(wizard.getFingerprint()).isEmpty();
        assertThat(wizard.getAfter().getTargetDate()).isNotNull();

        SeasonResponse created = postForBody("/api/seasons", draft, u.headers(), HttpStatus.CREATED, SeasonResponse.class);
        assertThat(created.getStatus()).isEqualTo(SeasonResponse.StatusEnum.PLANNED);
        assertThat(created.getEndDate()).isEqualTo(created.getStartDate().plusDays(created.getWeeks() * 7L - 1));

        SeasonResponse active = postForBody("/api/seasons/" + created.getId() + "/activate", null, u.headers(),
            HttpStatus.OK, SeasonResponse.class);
        assertThat(active.getStatus()).isEqualTo(SeasonResponse.StatusEnum.ACTIVE);
        assertThat(active.getSleepNeedMin()).isEqualTo(486);

        SeasonDraft change = active.getDraft();
        change.setGymDays(new ArrayList<>(List.of(0, 1, 2, 3, 4)));
        SeasonPreview preview = postForBody("/api/seasons/" + created.getId() + "/preview", change, u.headers(),
            HttpStatus.OK, SeasonPreview.class);
        assertThat(preview.getAfter().getSleepNeedMin()).isEqualTo(492);
        assertThat(preview.getTodo()).extracting(t -> t.getKey()).contains("earlier_bed", "block");

        SeasonApply apply = SeasonApply.builder().draft(change).fingerprint(preview.getFingerprint()).build();
        SeasonResponse applied = putForBody("/api/seasons/" + created.getId(), apply, u.headers(), HttpStatus.OK,
            SeasonResponse.class);
        assertThat(applied.getDraft().getGymDays()).containsExactly(0, 1, 2, 3, 4);
        assertThat(applied.getSleepNeedMin()).isEqualTo(492);

        SeasonOverview overview = getForBody("/api/seasons/active/overview", u.headers(), HttpStatus.OK,
            SeasonOverview.class);
        assertThat(overview.getSeason().getId()).isEqualTo(created.getId());
        assertThat(overview.getPillars().getBlock().getGymDays()).containsExactly(0, 1, 2, 3, 4);

        String stale = putForBody("/api/seasons/" + created.getId(), apply, u.headers(), HttpStatus.CONFLICT,
            String.class);
        assertHasRequestError(stale, "SEASON_PREVIEW_STALE");

        SeasonResponse ruled = putForBody("/api/seasons/" + created.getId() + "/rules", SeasonRules.builder()
                .processedFoodMaxNova(3).deloadMaintain(false).useLearnedExpenditure(true).proposeExperiments(false)
                .menuDay(null).menuTime("19:30").build(),
            u.headers(), HttpStatus.OK, SeasonResponse.class);
        assertThat(ruled.getRules().getMenuDay()).isNull();
        assertThat(ruled.getRules().getProcessedFoodMaxNova()).isEqualTo(3);

        assertThat(getForList("/api/seasons", u.headers(), HttpStatus.OK, SeasonResponse.class)).hasSize(1);

        SeasonResponse closed = postForBody("/api/seasons/" + created.getId() + "/close", null, u.headers(),
            HttpStatus.OK, SeasonResponse.class);
        assertThat(closed.getStatus()).isEqualTo(SeasonResponse.StatusEnum.CLOSED);
        String notEditable = postForBody("/api/seasons/" + created.getId() + "/preview", change, u.headers(),
            HttpStatus.CONFLICT, String.class);
        assertHasRequestError(notEditable, "SEASON_NOT_EDITABLE");
    }

    @Test
    void activateWithAnIncoherentLiveGoalIs200() {
        RegisteredUser u = registerUser("EvadLegacy");
        fixture.owner(u.email());
        goalPopulator.createLegacyIncoherentGoal(u.id(), null); // a live goal the engine cannot project

        SeasonDraft draft = getForBody("/api/seasons/draft", u.headers(), HttpStatus.OK, SeasonDraft.class);
        draft.setTrajectory(SeasonDraft.TrajectoryEnum.MAINTAIN);
        draft.setTargetWeightKg(null);
        SeasonResponse created = postForBody("/api/seasons", draft, u.headers(), HttpStatus.CREATED, SeasonResponse.class);

        SeasonResponse active = postForBody("/api/seasons/" + created.getId() + "/activate", null, u.headers(),
            HttpStatus.OK, SeasonResponse.class);
        assertThat(active.getStatus()).isEqualTo(SeasonResponse.StatusEnum.ACTIVE);
    }

    @Test
    void anotherOwnersSeasonIs404() {
        RegisteredUser a = registerUser("EvadA");
        RegisteredUser b = registerUser("EvadB");
        fixture.owner(a.email());
        SeasonDraft draft = getForBody("/api/seasons/draft", a.headers(), HttpStatus.OK, SeasonDraft.class);
        SeasonResponse created = postForBody("/api/seasons", draft, a.headers(), HttpStatus.CREATED, SeasonResponse.class);

        postForBody("/api/seasons/" + created.getId() + "/activate", null, b.headers(), HttpStatus.NOT_FOUND, String.class);
        assertThat(getForList("/api/seasons", b.headers(), HttpStatus.OK, SeasonResponse.class)).isEmpty();
    }
}

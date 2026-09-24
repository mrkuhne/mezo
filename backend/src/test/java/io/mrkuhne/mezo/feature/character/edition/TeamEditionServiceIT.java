package io.mrkuhne.mezo.feature.character.edition;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.EditionFactsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.EditionGuestsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.EditionRefsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.TeamEditionEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamEditionPostEntity;
import io.mrkuhne.mezo.feature.character.repository.CharacterRunRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamEditionPostRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamEditionRepository;
import io.mrkuhne.mezo.feature.character.service.edition.TeamEditionService;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.ExperimentPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.PredictionPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * IT for {@link TeamEditionService} (Task 5, csapatfal H1 spec 2026-09-24 §3): {@code run} is
 * idempotent per {@code (created_by, day)}, publishes 3-6 ranked posts (or a QUIET edition with
 * none), and honours the EditionSelector's 7-day repeat-ban. The job hookup + feature switch are
 * covered by the sibling {@link TeamEditionServiceSwitchOffIT} (kept in its own top-level class —
 * mixing a real always-on IT class with a differently-propertied {@code @Nested} class confuses
 * Spring's test-context cache, see {@code CharacterObservationJobIT}'s wrapper idiom instead).
 */
@ActiveProfiles("companion-fake")
class TeamEditionServiceIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 9, 24);

    @Autowired private TeamEditionService service;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PredictionPopulator predictionPopulator;
    @Autowired private ExperimentPopulator experimentPopulator;
    @Autowired private TeamEditionRepository editions;
    @Autowired private TeamEditionPostRepository posts;
    @Autowired private CharacterRunRepository runs;

    private UUID owner() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private List<TeamEditionPostEntity> postsOf(TeamEditionEntity edition) {
        return posts.findByEditionIdInOrderByEditionIdAscRankAsc(List.of(edition.getId()));
    }

    @Test
    void run_publishesRankedEdition_fromSeededCandidates() {
        UUID owner = owner();
        PatternEntity pattern = patternPopulator.statistical(owner); // proposed -> waiting KERDES
        predictionPopulator.prediction(owner, DAY.minusDays(10), "sleep_avg", "up",
                PredictionEntity.STATUS_VALIDATED); // validTo = DAY-4, resolved -> ELOREJELZES
        experimentPopulator.active(owner, "sleep_avg", "up", DAY, 7); // day 1/7 -> KISERLET

        service.run(owner, DAY);

        TeamEditionEntity edition = editions.findByCreatedByAndDay(owner, DAY).orElseThrow();
        assertThat(edition.getStatus()).isEqualTo("PUBLISHED");

        List<TeamEditionPostEntity> published = postsOf(edition);
        assertThat(published).hasSize(3);
        TeamEditionPostEntity first = published.get(0);
        assertThat(first.getRank()).isEqualTo((short) 1);
        assertThat(first.getSourceKind()).isEqualTo("pattern");
        assertThat(first.getSourceId()).isEqualTo(pattern.getId().toString());
        assertThat(first.getGenre()).isEqualTo("kerdes");
        assertThat(first.getVoiced()).isFalse();
        assertThat(first.getBody()).isEqualTo(pattern.getMechanism());
        assertThat(first.getTitle()).isEqualTo(pattern.getTitle());
    }

    @Test
    void run_isIdempotent_secondCallWritesNothingNew() {
        UUID owner = owner();
        patternPopulator.statistical(owner);

        service.run(owner, DAY);
        long editionCountAfterFirst = editions.findByCreatedByAndDayBetweenOrderByDayDesc(owner, DAY, DAY).size();
        service.run(owner, DAY);
        long editionCountAfterSecond = editions.findByCreatedByAndDayBetweenOrderByDayDesc(owner, DAY, DAY).size();

        assertThat(editionCountAfterFirst).isEqualTo(1);
        assertThat(editionCountAfterSecond).isEqualTo(1);
        long editionRunRowCount = runs.findByCreatedByAndDayBetweenOrderByDayDescGeneratedAtDesc(owner, DAY, DAY)
                .stream().filter(r -> "EDITION".equals(r.getKind())).count();
        assertThat(editionRunRowCount).isEqualTo(1); // exactly one EDITION run row, not just "present"
    }

    @Test
    void run_emptyUser_publishesQuietEditionWithNoPosts() {
        UUID owner = userPopulator.createUser().getId();

        service.run(owner, DAY);

        TeamEditionEntity edition = editions.findByCreatedByAndDay(owner, DAY).orElseThrow();
        assertThat(edition.getStatus()).isEqualTo("QUIET");
        assertThat(postsOf(edition)).isEmpty();
    }

    @Test
    void run_repeatBan_sameUnchangedSourceShownYesterday_isExcludedToday() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity pattern = patternPopulator.statistical(owner); // proposed, lastDetectedAt stays null

        TeamEditionEntity yesterday = new TeamEditionEntity();
        yesterday.setCreatedBy(owner);
        yesterday.setDay(DAY.minusDays(1));
        yesterday.setStatus("PUBLISHED");
        yesterday.setGeneratedAt(Instant.now());
        yesterday = editions.saveAndFlush(yesterday);

        TeamEditionPostEntity shown = new TeamEditionPostEntity();
        shown.setCreatedBy(owner);
        shown.setEditionId(yesterday.getId());
        shown.setRank((short) 1);
        shown.setCharacterKey("mezo");
        shown.setGenre("kerdes");
        shown.setSourceKind("pattern");
        shown.setSourceId(pattern.getId().toString());
        shown.setSourceRoute("/mezo/patterns/x");
        shown.setTitle("Cím");
        shown.setBody("Szöveg.");
        shown.setVoiced(false);
        shown.setFacts(new EditionFactsEnvelope(List.of()));
        shown.setRefs(new EditionRefsEnvelope(List.of()));
        shown.setGuests(new EditionGuestsEnvelope(List.of()));
        posts.saveAndFlush(shown);

        service.run(owner, DAY);

        TeamEditionEntity today = editions.findByCreatedByAndDay(owner, DAY).orElseThrow();
        assertThat(postsOf(today)).extracting(TeamEditionPostEntity::getSourceId)
                .doesNotContain(pattern.getId().toString());
        assertThat(today.getStatus()).isEqualTo("QUIET"); // the only candidate in the world, and it's banned
    }
}

package io.mrkuhne.mezo.feature.character.edition;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterRunEntity;
import io.mrkuhne.mezo.feature.character.entity.EditionFactsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.EditionGuestsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.EditionRef;
import io.mrkuhne.mezo.feature.character.entity.EditionRefsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.RunDetectorKeysEnvelope;
import io.mrkuhne.mezo.feature.character.entity.RunExpertKeysEnvelope;
import io.mrkuhne.mezo.feature.character.entity.TeamEditionEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamEditionPostEntity;
import io.mrkuhne.mezo.feature.character.repository.CharacterRunRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamEditionPostRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamEditionRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

/**
 * Schema IT for the {@code team_edition} / {@code team_edition_post} tables and the
 * {@code character_run.kind += EDITION} extension (mezo-a9bo7.12, csapatfal H1 Task 3):
 * saves an edition with 2 posts and reads it back rank-ordered with its jsonb envelopes,
 * asserts the (created_by, day) live-edition uniqueness backstop, the {@code EDITION}
 * character_run kind, and the {@code character_key} check constraint.
 */
@ActiveProfiles("companion-fake")
class TeamEditionSchemaIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 9, 24);

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private TeamEditionRepository editionRepository;
    @Autowired private TeamEditionPostRepository postRepository;
    @Autowired private CharacterRunRepository runRepository;

    private UUID owner() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private TeamEditionEntity newEdition(UUID owner, LocalDate day) {
        TeamEditionEntity edition = new TeamEditionEntity();
        edition.setCreatedBy(owner);
        edition.setDay(day);
        edition.setStatus("PUBLISHED");
        edition.setGeneratedAt(Instant.now());
        return edition;
    }

    private TeamEditionPostEntity newPost(UUID owner, UUID editionId, short rank, String characterKey) {
        TeamEditionPostEntity post = new TeamEditionPostEntity();
        post.setCreatedBy(owner);
        post.setEditionId(editionId);
        post.setRank(rank);
        post.setCharacterKey(characterKey);
        post.setGenre("megfigyeles");
        post.setSourceKind("pattern");
        post.setSourceId("pattern-1");
        post.setSourceRoute("/train/patterns/1");
        post.setTitle("Cím");
        post.setBody("Szöveg.");
        post.setVoiced(false);
        post.setFacts(new EditionFactsEnvelope(List.of("tény 1")));
        post.setRefs(new EditionRefsEnvelope(List.of(new EditionRef("pattern", "pattern-1"))));
        post.setGuests(new EditionGuestsEnvelope(List.of()));
        return post;
    }

    @Test
    void savesEditionWithPosts_andReadsBackInRankOrder() {
        UUID owner = owner();
        TeamEditionEntity edition = editionRepository.saveAndFlush(newEdition(owner, DAY));

        TeamEditionPostEntity second = newPost(owner, edition.getId(), (short) 2, "mocor");
        TeamEditionPostEntity first = newPost(owner, edition.getId(), (short) 1, "szunya");
        postRepository.saveAndFlush(second);
        postRepository.saveAndFlush(first);

        List<TeamEditionPostEntity> posts =
                postRepository.findByEditionIdInOrderByEditionIdAscRankAsc(List.of(edition.getId()));

        assertThat(posts).hasSize(2);
        assertThat(posts.get(0).getRank()).isEqualTo((short) 1);
        assertThat(posts.get(0).getCharacterKey()).isEqualTo("szunya");
        assertThat(posts.get(1).getRank()).isEqualTo((short) 2);
        assertThat(posts.get(1).getCharacterKey()).isEqualTo("mocor");
        assertThat(posts.get(0).getFacts().facts()).containsExactly("tény 1");
        assertThat(posts.get(0).getRefs().refs()).containsExactly(new EditionRef("pattern", "pattern-1"));
        assertThat(posts.get(0).getGuests().guests()).isEmpty();

        assertThat(editionRepository.findByCreatedByAndDay(owner, DAY)).isPresent();
    }

    @Test
    void duplicateLiveEditionSameDay_rejectedByUniqueIndex() {
        UUID owner = owner();
        editionRepository.saveAndFlush(newEdition(owner, DAY));

        TeamEditionEntity duplicate = newEdition(owner, DAY);
        assertThatThrownBy(() -> editionRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void characterRun_editionKind_savesSuccessfully() {
        UUID owner = owner();
        CharacterRunEntity run = new CharacterRunEntity();
        run.setCreatedBy(owner);
        run.setKind("EDITION");
        run.setDay(DAY);
        run.setObservationCount(0);
        run.setCallCount(0);
        run.setDetectorKeys(new RunDetectorKeysEnvelope(List.of()));
        run.setExpertKeys(new RunExpertKeysEnvelope(List.of()));
        run.setGeneratedAt(Instant.now());

        CharacterRunEntity saved = runRepository.saveAndFlush(run);

        assertThat(saved.getId()).isNotNull();
        assertThat(runRepository.findByCreatedByAndKindAndDay(owner, "EDITION", DAY)).isPresent();
    }

    @Test
    void invalidCharacterKey_rejectedByCheckConstraint() {
        UUID owner = owner();
        TeamEditionEntity edition = editionRepository.saveAndFlush(newEdition(owner, DAY));

        TeamEditionPostEntity invalid = newPost(owner, edition.getId(), (short) 1, "szkeptikus");

        assertThatThrownBy(() -> postRepository.saveAndFlush(invalid))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}

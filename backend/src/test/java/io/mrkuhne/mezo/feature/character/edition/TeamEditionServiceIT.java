package io.mrkuhne.mezo.feature.character.edition;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.ConferenceDeliberationEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import io.mrkuhne.mezo.feature.character.entity.EditionFactsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.EditionGuestsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.EditionRefsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.TeamEditionEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamEditionPostEntity;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterRunRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamEditionPostRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamEditionRepository;
import io.mrkuhne.mezo.feature.character.service.edition.TeamEditionService;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
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
    @Autowired private AppNotificationRepository appNotifications;
    @Autowired private CharacterConferenceRepository conferences;

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
        // H3 (mezo-a9bo7.14): a poszt a karakter hangján szólal meg; a fake determinisztikus hangja
        // a rekord szövege + egy második mondat, ami átmegy a tény-őrön.
        assertThat(first.getVoiced()).isTrue();
        assertThat(first.getBody()).isEqualTo(FakeCompanionLlm.editionBody(pattern.getMechanism()));
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

    /** csapatfal H2 (mezo-a9bo7.13): a kiadás megérkezését egyetlen értesítés jelzi, és az
     *  idempotens második futás nem szül újat (a dedup kulcs a nap). */
    @Test
    void run_published_emitsOneEditionNotification_evenWhenRunTwice() {
        UUID owner = owner();
        patternPopulator.statistical(owner);
        experimentPopulator.active(owner, "sleep_avg", "up", DAY, 7);

        service.run(owner, DAY);
        service.run(owner, DAY);

        TeamEditionEntity edition = editions.findByCreatedByAndDay(owner, DAY).orElseThrow();
        int postCount = postsOf(edition).size();
        assertThat(postCount).isPositive();
        assertThat(appNotifications.findByCreatedByAndReadAtIsNullAndDeletedFalse(owner))
                .filteredOn(n -> AppNotificationKind.TEAM_EDITION.key().equals(n.getKind()))
                .singleElement()
                .satisfies(n -> {
                    assertThat(n.getTitle()).isEqualTo("Megjött az esti kiadás");
                    assertThat(n.getBody()).isEqualTo(postCount + " bejegyzés a csapattól");
                    assertThat(n.getDeeplink()).isEqualTo("/mezo");
                    assertThat(n.getRefId()).isEqualTo(edition.getId());
                    assertThat(n.getDedupKey()).isEqualTo("team_edition:" + DAY);
                });
    }

    /** Csendes nap: a kiadás megszületik, de nincs mit jelenteni — a telefon néma marad. */
    @Test
    void run_quietEdition_doesNotNotify() {
        UUID owner = userPopulator.createUser().getId();

        service.run(owner, DAY);

        assertThat(appNotifications.findByCreatedByAndReadAtIsNullAndDeletedFalse(owner))
                .filteredOn(n -> AppNotificationKind.TEAM_EDITION.key().equals(n.getKind()))
                .isEmpty();
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

    // ---- vendég-sorok (H4, mezo-a9bo7.15) ------------------------------------------------------

    private static final String PEER_ARGUMENT = "A késői vacsora is közrejátszhat.";
    private static final String SKEPTIC_ARGUMENT = "A hétvége önmagában is megmagyarázza.";

    /** A nap DAILY konzíliuma egy szállal: Szunya javasol, Falat reagál, a Szkeptikus ítél. */
    private void dailyConference(UUID owner, String proposalText) {
        var item = new ConferenceDeliberationEnvelope.Item(0, "szomnologus", proposalText, "NEW", null, false,
                List.of(new ConferenceDeliberationEnvelope.PeerReaction("taplalkozo", "SUPPORT", PEER_ARGUMENT)),
                new ConferenceDeliberationEnvelope.SkepticVerdict("WEAKEN", SKEPTIC_ARGUMENT, null), null);
        CharacterConferenceEntity conference = new CharacterConferenceEntity();
        conference.setCreatedBy(owner);
        conference.setKind("DAILY");
        conference.setWeekStart(DAY);
        conference.setGeneratedAt(Instant.parse("2026-09-24T18:00:00Z"));
        conference.setTranscript(new ConferenceTranscriptEnvelope(List.of()));
        conference.setOutcome(new ConferenceOutcomeEnvelope(List.of()));
        conference.setDeliberation(new ConferenceDeliberationEnvelope(List.of(
                new ConferenceDeliberationEnvelope.Thread("sleep", "Alvás", List.of(item)))));
        conferences.saveAndFlush(conference);
    }

    private TeamEditionPostEntity konziliumPost(UUID owner) {
        TeamEditionEntity edition = editions.findByCreatedByAndDay(owner, DAY).orElseThrow();
        return postsOf(edition).stream().filter(p -> "konzilium".equals(p.getSourceKind()))
                .findFirst().orElseThrow();
    }

    /** A konzílium-szál vendége a résztvevő szakértő karaktere + a Szkeptikus, hangosan mentve. */
    @Test
    void run_konziliumThread_publishesTheParticipantsAsVoicedGuests() {
        UUID owner = userPopulator.createUser().getId();
        dailyConference(owner, "Az esti lefekvés és a másnapi energia együtt mozog.");

        service.run(owner, DAY);

        TeamEditionPostEntity post = konziliumPost(owner);
        assertThat(post.getCharacterKey()).isEqualTo("szunya");
        assertThat(post.getGuests().guests()).containsExactly(
                new EditionGuestsEnvelope.Guest("falat", FakeCompanionLlm.EDITION_GUEST_BODY, true),
                new EditionGuestsEnvelope.Guest("szkeptikus", FakeCompanionLlm.EDITION_GUEST_BODY, true));
    }

    /** Hibás hang-válasz: a konzílium-vendégek a saját meglévő érvükkel, hangtalanul jelennek meg. */
    @Test
    void run_malformedVoice_konziliumPostKeepsTheFallbackGuests() {
        UUID owner = userPopulator.createUser().getId();
        dailyConference(owner, "Az esti lefekvés és a másnapi energia együtt mozog. "
                + FakeCompanionLlm.EDITION_MALFORMED);

        service.run(owner, DAY);

        TeamEditionPostEntity post = konziliumPost(owner);
        assertThat(post.getVoiced()).isFalse();
        assertThat(post.getGuests().guests()).containsExactly(
                new EditionGuestsEnvelope.Guest("falat", PEER_ARGUMENT, false),
                new EditionGuestsEnvelope.Guest("szkeptikus", SKEPTIC_ARGUMENT, false));
    }
}

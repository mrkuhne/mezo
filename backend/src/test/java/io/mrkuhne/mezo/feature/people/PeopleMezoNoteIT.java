package io.mrkuhne.mezo.feature.people;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PeopleResponse;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.service.PeopleService;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import io.mrkuhne.mezo.support.populator.MentionPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Emberek S6 (mezo-06o0.8): a bootstrap {@code mezoNote} sávjának forrás-prioritása — a mai
 * {@code people} companion-üzenet, vagy annak hiányában a {@link PeopleService}
 * determinisztikus tartaléka. Service-level, a {@code PeopleServiceIT} idiómája: fresh user per
 * teszt, {@code @Transactional}, HTTP nélkül.
 */
@Transactional
class PeopleMezoNoteIT extends AbstractIntegrationTest {

    @Autowired private PeopleService peopleService;
    @Autowired private PersonPopulator personPopulator;
    @Autowired private MentionPopulator mentionPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private CompanionMessagePopulator companionMessagePopulator;

    @Test
    void testGetBootstrap_shouldUseTodaysCompanionMessage_whenOneExists() {
        UUID owner = userPopulator.createUser("owner-mezonote-msg@test.hu").getId();
        personPopulator.createPerson(owner, "Petra");
        companionMessagePopulator.createMessage(owner, LocalDate.now(), CompanionMessageEntity.KIND_PEOPLE,
            "Emberek", List.of("Petra sokat volt szóban ezen a héten."));

        PeopleResponse res = peopleService.getBootstrap(owner);

        assertThat(res.getMezoNote()).isEqualTo("Petra sokat volt szóban ezen a héten.");
    }

    @Test
    void testGetBootstrap_shouldJoinMultiParagraphMessage_withSingleSpace() {
        UUID owner = userPopulator.createUser("owner-mezonote-multi@test.hu").getId();
        companionMessagePopulator.createMessage(owner, LocalDate.now(), CompanionMessageEntity.KIND_PEOPLE,
            "Emberek", List.of("Első bekezdés.", "Második bekezdés."));

        PeopleResponse res = peopleService.getBootstrap(owner);

        assertThat(res.getMezoNote()).isEqualTo("Első bekezdés. Második bekezdés.");
    }

    @Test
    void testGetBootstrap_shouldIgnoreBlankTodaysMessage_andUseFallback() {
        // Egy üres/blank mai üzenet nem jobb a tartaléknál — az adapter Optional.empty()-t ad.
        UUID owner = userPopulator.createUser("owner-mezonote-blank@test.hu").getId();
        companionMessagePopulator.createMessage(owner, LocalDate.now(), CompanionMessageEntity.KIND_PEOPLE,
            "Emberek", List.of("   ", ""));

        PeopleResponse res = peopleService.getBootstrap(owner);

        assertThat(res.getMezoNote()).isEqualTo("Még nincs elég említés a heti képhez.");
    }

    @Test
    void testGetBootstrap_shouldFallBackToMostMentioned_whenNoTodaysMessageButWeeklyMentionExists() {
        UUID owner = userPopulator.createUser("owner-mezonote-fallback-mention@test.hu").getId();
        PersonEntity petra = personPopulator.createPerson(owner, "Petra");
        mentionPopulator.createMention(owner, petra.getId(), Instant.now(), "positive");

        PeopleResponse res = peopleService.getBootstrap(owner);

        assertThat(res.getMezoNote()).isEqualTo("Petra volt a leggyakoribb neved ezen a héten.");
    }

    @Test
    void testGetBootstrap_shouldPreferAlphabeticalName_whenMostMentionedTied() {
        UUID owner = userPopulator.createUser("owner-mezonote-tie@test.hu").getId();
        PersonEntity zita = personPopulator.createPerson(owner, "Zita");
        PersonEntity anna = personPopulator.createPerson(owner, "Anna");
        mentionPopulator.createMention(owner, zita.getId(), Instant.now(), "positive");
        mentionPopulator.createMention(owner, anna.getId(), Instant.now(), "positive");

        PeopleResponse res = peopleService.getBootstrap(owner);

        assertThat(res.getMezoNote()).isEqualTo("Anna volt a leggyakoribb neved ezen a héten.");
    }

    @Test
    void testGetBootstrap_shouldFallBackToTurnedDownPerson_whenDirectionIsDown() {
        // 3 különböző hét (a calculator MIN_READINGS_FOR_DIRECTION-je), a legutóbbi kettő
        // tónusa lefelé húzza az átlagot a korábbihoz képest -> direction=down.
        UUID owner = userPopulator.createUser("owner-mezonote-down@test.hu").getId();
        PersonEntity petra = personPopulator.createPerson(owner, "Petra");
        Instant now = Instant.now();
        mentionPopulator.createMention(owner, petra.getId(), now.minus(Duration.ofDays(21)), "positive");
        mentionPopulator.createMention(owner, petra.getId(), now.minus(Duration.ofDays(14)), "positive");
        mentionPopulator.createMention(owner, petra.getId(), now, "negative");

        PeopleResponse res = peopleService.getBootstrap(owner);

        assertThat(res.getMezoNote())
            .isEqualTo("Petra hangulata lefelé fordult — többször nehéz tónus, mint korábban.");
    }

    @Test
    void testGetBootstrap_shouldSkipTurnedDownCandidate_andFallThroughPastAllActiveCases() {
        // Jelöltek inbox: egy meg nem erősített extractor-találat, három lefelé húzó tónussal —
        // a hangulat-ív itt is "down"-t számol, de a mondat nem nevezhet meg jelöltet. Mivel
        // nincs más (aktív) személy, a mostMentioned/unmentioned esetek is kimaradnak, és az
        // általános tartalékra kell esnie — nem szabad "Kata"-t megnevezni sehol.
        UUID owner = userPopulator.createUser("owner-mezonote-candidate-down@test.hu").getId();
        PersonEntity candidate = personPopulator.createCandidate(owner, "Kata", "Jelölt teszt személy.");
        Instant now = Instant.now();
        mentionPopulator.createMention(owner, candidate.getId(), now.minus(Duration.ofDays(21)), "positive");
        mentionPopulator.createMention(owner, candidate.getId(), now.minus(Duration.ofDays(14)), "positive");
        mentionPopulator.createMention(owner, candidate.getId(), now, "negative");

        PeopleResponse res = peopleService.getBootstrap(owner);

        assertThat(res.getMezoNote()).isEqualTo("Még nincs elég említés a heti képhez.");
    }

    @Test
    void testGetBootstrap_shouldFallBackToUnmentionedActivePerson_whenNoOneMentionedThisWeek() {
        UUID owner = userPopulator.createUser("owner-mezonote-unmentioned@test.hu").getId();
        PersonEntity petra = personPopulator.createPerson(owner, "Petra");
        // 10 napja, tehát a gördülő 7 napos ablakon KÍVÜL — mentionCount>0, mentionsThisWeek=0.
        mentionPopulator.createMention(owner, petra.getId(), Instant.now().minus(Duration.ofDays(10)), "positive");

        PeopleResponse res = peopleService.getBootstrap(owner);

        assertThat(res.getMezoNote()).isEqualTo("Petra nem került szóba ezen a héten.");
    }

    @Test
    void testGetBootstrap_shouldReturnGeneralFallback_whenNoDataAtAll() {
        UUID owner = userPopulator.createUser("owner-mezonote-empty@test.hu").getId();

        PeopleResponse res = peopleService.getBootstrap(owner);

        assertThat(res.getMezoNote())
            .isNotBlank()
            .isEqualTo("Még nincs elég említés a heti képhez.")
            .doesNotContain("null");
    }
}

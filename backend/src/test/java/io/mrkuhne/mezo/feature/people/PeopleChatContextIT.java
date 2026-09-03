package io.mrkuhne.mezo.feature.people;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.api.dto.PeopleResponse;
import io.mrkuhne.mezo.api.dto.PersonResponse;
import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.feature.people.repository.PersonRepository;
import io.mrkuhne.mezo.feature.people.service.PeopleService;
import io.mrkuhne.mezo.feature.people.service.PersonChatContext;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MentionPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * mezo-x6oa: a chat kontextus-pillanatkép people-oldali olvasója — csak aktív személyek, utolsó
 * említés szerint, a bootstrap heti-szám/irány képletével. Service-level, a
 * {@code PeopleMezoNoteIT} idiómája: fresh user per teszt, {@code @Transactional}, HTTP nélkül.
 */
@Transactional
class PeopleChatContextIT extends AbstractIntegrationTest {

    @Autowired private PeopleService peopleService;
    @Autowired private PersonPopulator personPopulator;
    @Autowired private MentionPopulator mentionPopulator;
    @Autowired private PersonRepository personRepository;
    @Autowired private MentionRepository mentionRepository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testChatContext_shouldReturnOnlyActivePersons_whenCandidateAndArchivedExist() {
        UUID owner = userPopulator.createUser("owner-chatctx-status@test.hu").getId();
        personPopulator.createPerson(owner, "Anna");
        personPopulator.createCandidate(owner, "Jelölt Jenő", "extractor");
        PersonEntity archived = personPopulator.createPerson(owner, "Archivált Ágnes");
        archived.setStatus("archived");
        personRepository.saveAndFlush(archived);

        List<PersonChatContext> ctx = peopleService.chatContext(owner, LocalDate.now());

        assertThat(ctx).extracting(PersonChatContext::name).containsExactly("Anna");
        assertThat(ctx.getFirst().relationshipHu()).isEqualTo("Mentee · teszt");
    }

    @Test
    void testChatContext_shouldOrderByLastMentionDesc_withUnmentionedLastByName() {
        UUID owner = userPopulator.createUser("owner-chatctx-order@test.hu").getId();
        PersonEntity zita = personPopulator.createPerson(owner, "Zita");
        PersonEntity bela = personPopulator.createPerson(owner, "Béla");
        PersonEntity anna = personPopulator.createPerson(owner, "Anna");
        personPopulator.createPerson(owner, "Néma Nóra");
        personPopulator.createPerson(owner, "Csendes Csaba");
        Instant now = Instant.now();
        mentionPopulator.createMention(owner, anna.getId(), now.minus(Duration.ofDays(3)), "positive");
        mentionPopulator.createMention(owner, zita.getId(), now.minus(Duration.ofHours(1)), "positive");
        mentionPopulator.createMention(owner, bela.getId(), now.minus(Duration.ofDays(1)), "neutral");

        List<PersonChatContext> ctx = peopleService.chatContext(owner, LocalDate.now());

        assertThat(ctx).extracting(PersonChatContext::name)
            .containsExactly("Zita", "Béla", "Anna", "Csendes Csaba", "Néma Nóra");
        assertThat(ctx.get(3).lastMentionAt()).isNull();
        assertThat(ctx.get(3).mentionsThisWeek()).isZero();
    }

    @Test
    void testChatContext_shouldCountOnlyLastSevenDays_andSkipDeletedMentions() {
        UUID owner = userPopulator.createUser("owner-chatctx-week@test.hu").getId();
        PersonEntity anna = personPopulator.createPerson(owner, "Anna");
        Instant now = Instant.now();
        mentionPopulator.createMention(owner, anna.getId(), now.minus(Duration.ofDays(1)), "positive");
        mentionPopulator.createMention(owner, anna.getId(), now.minus(Duration.ofDays(6)), "positive");
        mentionPopulator.createMention(owner, anna.getId(), now.minus(Duration.ofDays(9)), "positive");
        MentionEntity deleted = mentionPopulator.createMention(owner, anna.getId(), now.minus(Duration.ofHours(2)), "negative");
        mentionRepository.delete(deleted); // @SQLDelete → soft delete
        mentionRepository.flush();

        List<PersonChatContext> ctx = peopleService.chatContext(owner, LocalDate.now());

        assertThat(ctx).hasSize(1);
        assertThat(ctx.getFirst().mentionsThisWeek()).isEqualTo(2);
        // Precízió-független: a @Transactional teszt a first-level cache-ből kapja vissza az
        // entitást, tehát a beírt óra-precíziót (Linuxon nano, macOS-en mikro) őrzi — a lényeg,
        // hogy a LEGFRISSEBB nem törölt említés ideje jöjjön vissza, ne az órák felbontása.
        assertThat(ctx.getFirst().lastMentionAt())
            .isCloseTo(now.minus(Duration.ofDays(1)), within(1, ChronoUnit.MILLIS));
    }

    @Test
    void testChatContext_shouldAgreeWithBootstrapDirection_forTheSameMentions() {
        UUID owner = userPopulator.createUser("owner-chatctx-dir@test.hu").getId();
        PersonEntity bence = personPopulator.createPerson(owner, "Bence");
        Instant now = Instant.now();
        // 4 hét: két jó, majd két nehéz hét → a kalkulátor 'down'-t ad
        mentionPopulator.createMention(owner, bence.getId(), now.minus(Duration.ofDays(24)), "positive");
        mentionPopulator.createMention(owner, bence.getId(), now.minus(Duration.ofDays(17)), "positive");
        mentionPopulator.createMention(owner, bence.getId(), now.minus(Duration.ofDays(10)), "negative");
        mentionPopulator.createMention(owner, bence.getId(), now.minus(Duration.ofDays(3)), "negative");

        List<PersonChatContext> ctx = peopleService.chatContext(owner, LocalDate.now());
        PeopleResponse bootstrap = peopleService.getBootstrap(owner);
        PersonResponse fromBootstrap = bootstrap.getPersons().getFirst();

        assertThat(ctx.getFirst().direction()).isEqualTo(fromBootstrap.getDirection().getValue());
        assertThat(ctx.getFirst().directionReason()).isEqualTo(fromBootstrap.getDirectionReason());
        assertThat(ctx.getFirst().mentionsThisWeek()).isEqualTo(fromBootstrap.getMentionsThisWeek());
    }

    @Test
    void testChatContext_shouldReturnEmptyList_whenUserHasNoPerson() {
        UUID owner = userPopulator.createUser("owner-chatctx-empty@test.hu").getId();

        assertThat(peopleService.chatContext(owner, LocalDate.now())).isEmpty();
    }
}

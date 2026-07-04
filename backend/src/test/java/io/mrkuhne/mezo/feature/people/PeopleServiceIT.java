package io.mrkuhne.mezo.feature.people;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.LogMentionRequest;
import io.mrkuhne.mezo.api.dto.MentionResponse;
import io.mrkuhne.mezo.api.dto.PeopleResponse;
import io.mrkuhne.mezo.api.dto.PersonResponse;
import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.feature.people.service.PeopleService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MentionPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class PeopleServiceIT extends AbstractIntegrationTest {

    @Autowired private PeopleService peopleService;
    @Autowired private PersonPopulator personPopulator;
    @Autowired private MentionPopulator mentionPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private MentionRepository mentionRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    void testGetBootstrap_shouldComputeMentionStatsAndOrderByCountDesc_whenMentionsExist() {
        UUID owner = userPopulator.createUser("owner-people@test.hu").getId();
        PersonEntity quiet = personPopulator.createPerson(owner, "Anna");
        PersonEntity busy = personPopulator.createPerson(owner, "Zita");
        Instant now = Instant.now();
        mentionPopulator.createMention(owner, busy.getId(), now.minus(Duration.ofDays(10)), "positive");
        mentionPopulator.createMention(owner, busy.getId(), now.minus(Duration.ofDays(1)), "mixed");
        mentionPopulator.createMention(owner, quiet.getId(), now.minus(Duration.ofDays(2)), "neutral");

        PeopleResponse res = peopleService.getBootstrap(owner);

        // ordering: mention-count desc → Zita (2) before Anna (1), despite name order
        assertThat(res.getPersons()).extracting(PersonResponse::getName).containsExactly("Zita", "Anna");
        PersonResponse zita = res.getPersons().getFirst();
        assertThat(zita.getMentionCount()).isEqualTo(2);
        assertThat(zita.getMentionsThisWeek()).isEqualTo(1); // the 10-day-old one is outside the rolling 7d
        assertThat(zita.getLastMentionedAt()).isNotNull();
        // feed: ts desc, personName joined
        assertThat(res.getMentions()).hasSize(3);
        assertThat(res.getMentions().getFirst().getPersonName()).isEqualTo("Zita");
        assertThat(res.getMentions().getFirst().getTone()).isEqualTo(MentionResponse.ToneEnum.MIXED);
    }

    @Test
    void testGetBootstrap_shouldReturnOnlyOwnRows_whenTwoUsersHaveData() {
        UUID ownerA = userPopulator.createUser("owner-a-people@test.hu").getId();
        UUID ownerB = userPopulator.createUser("owner-b-people@test.hu").getId();
        PersonEntity mine = personPopulator.createPerson(ownerA, "Enyém");
        PersonEntity theirs = personPopulator.createPerson(ownerB, "Másé");
        mentionPopulator.createMention(ownerA, mine.getId(), Instant.now(), "positive");
        mentionPopulator.createMention(ownerB, theirs.getId(), Instant.now(), "positive");

        PeopleResponse res = peopleService.getBootstrap(ownerA);

        assertThat(res.getPersons()).extracting(PersonResponse::getName).containsExactly("Enyém");
        assertThat(res.getMentions()).hasSize(1);
        assertThat(res.getMentions().getFirst().getPersonName()).isEqualTo("Enyém");
    }

    @Test
    void testLogMention_shouldStampServerFieldsAndPersist_whenPersonOwned() {
        UUID owner = userPopulator.createUser("owner-log@test.hu").getId();
        PersonEntity petra = personPopulator.createPerson(owner, "Petra");

        MentionResponse res = peopleService.logMention(owner, petra.getId(),
            new LogMentionRequest("mixed", "Hosszú beszélgetés."));

        assertThat(res.getPersonId()).isEqualTo(petra.getId());
        assertThat(res.getPersonName()).isEqualTo("Petra");
        assertThat(res.getSource()).isEqualTo(MentionResponse.SourceEnum.CHIP);
        assertThat(res.getFlagged()).isFalse();
        assertThat(res.getExcerpt()).isEqualTo("Hosszú beszélgetés.");
        assertThat(res.getTs()).isNotNull();
        assertThat(mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(owner)).hasSize(1);
    }

    @Test
    void testLogMention_shouldReturn404_whenPersonForeignOrMissing() {
        UUID ownerA = userPopulator.createUser("owner-404a@test.hu").getId();
        UUID ownerB = userPopulator.createUser("owner-404b@test.hu").getId();
        PersonEntity theirs = personPopulator.createPerson(ownerB, "Másé");

        assertThatThrownBy(() -> peopleService.logMention(ownerA, theirs.getId(),
            new LogMentionRequest("positive", null)))
            .isInstanceOf(SystemRuntimeErrorException.class);
        assertThatThrownBy(() -> peopleService.logMention(ownerA, UUID.randomUUID(),
            new LogMentionRequest("positive", null)))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testGetBootstrap_shouldExcludeSoftDeletedMention_whenRowDeleted() {
        UUID owner = userPopulator.createUser("owner-softdel@test.hu").getId();
        PersonEntity p = personPopulator.createPerson(owner, "Anna");
        MentionEntity m = mentionPopulator.createMention(owner, p.getId(), Instant.now(), "positive");

        mentionRepository.delete(m); // @SQLDelete → is_deleted=true
        mentionRepository.flush();

        PeopleResponse res = peopleService.getBootstrap(owner);
        assertThat(res.getMentions()).isEmpty();
        assertThat(res.getPersons().getFirst().getMentionCount()).isZero();
        // the physical row survives — soft delete, not a DELETE
        Integer physical = jdbcTemplate.queryForObject(
            "select count(*) from mention where id = ?", Integer.class, m.getId());
        assertThat(physical).isEqualTo(1);
    }
}

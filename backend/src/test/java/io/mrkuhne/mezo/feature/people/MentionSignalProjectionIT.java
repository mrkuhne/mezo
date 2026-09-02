package io.mrkuhne.mezo.feature.people;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.feature.people.repository.MentionSignal;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MentionPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * mezo-cc6x: {@link MentionRepository#findSignals} — a hangulat-számítás négy-mezős
 * projekciója. A finder szemantikájának a meglévő {@code findAllByCreatedByAndDeletedFalse
 * OrderByTsDesc}-vel kell megegyeznie (sorrend, soft-delete, ownership), csak kevesebb oszlopot
 * hoz vissza.
 */
@Transactional
class MentionSignalProjectionIT extends AbstractIntegrationTest {

    @Autowired private PersonPopulator personPopulator;
    @Autowired private MentionPopulator mentionPopulator;
    @Autowired private MentionRepository mentionRepository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void findSignals_shouldExcludeDeleted_orderByTsDesc_andCarryNullToneAndIntensity() {
        UUID owner = userPopulator.createUser("owner-mentionsignal@test.hu").getId();
        UUID other = userPopulator.createUser("other-mentionsignal@test.hu").getId();
        PersonEntity anna = personPopulator.createPerson(owner, "Anna");
        Instant now = Instant.now();

        MentionEntity oldest = mentionPopulator.createMention(owner, anna.getId(),
            now.minus(Duration.ofDays(2)), "positive");
        oldest.setIntensity((short) 3);
        mentionRepository.saveAndFlush(oldest);

        // se tone, se intensity — a chip-es és az S4 előtti soroknak felel meg
        MentionEntity middle = mentionPopulator.createMention(owner, anna.getId(),
            now.minus(Duration.ofDays(1)), null);

        MentionEntity newest = mentionPopulator.createMention(owner, anna.getId(), now, "negative");
        newest.setIntensity((short) 1);
        mentionRepository.saveAndFlush(newest);

        MentionEntity deleted = mentionPopulator.createMention(owner, anna.getId(),
            now.minus(Duration.ofHours(1)), "mixed");
        mentionRepository.delete(deleted); // @SQLDelete → soft delete
        mentionRepository.flush();

        // más felhasználó sora sosem szivároghat át
        PersonEntity otherPerson = personPopulator.createPerson(other, "Idegen Ilona");
        mentionPopulator.createMention(other, otherPerson.getId(), now, "positive");

        List<MentionSignal> signals = mentionRepository.findSignals(owner);

        assertThat(signals).hasSize(3); // a törölt sor nincs benne, az idegen felhasználóé se
        assertThat(signals).extracting(MentionSignal::ts)
            .containsExactly(newest.getTs(), middle.getTs(), oldest.getTs()); // ts szerint csökkenő

        MentionSignal newestSignal = signals.get(0);
        assertThat(newestSignal.personId()).isEqualTo(anna.getId());
        assertThat(newestSignal.tone()).isEqualTo("negative");
        assertThat(newestSignal.intensity()).isEqualTo((short) 1);

        MentionSignal middleSignal = signals.get(1);
        assertThat(middleSignal.tone()).isNull(); // null tónus null-ként jön át, nem robban
        assertThat(middleSignal.intensity()).isNull(); // ugyanígy a null intenzitás

        MentionSignal oldestSignal = signals.get(2);
        assertThat(oldestSignal.tone()).isEqualTo("positive");
        assertThat(oldestSignal.intensity()).isEqualTo((short) 3);
    }
}

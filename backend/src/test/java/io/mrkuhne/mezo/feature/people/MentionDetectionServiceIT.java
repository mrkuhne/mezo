package io.mrkuhne.mezo.feature.people;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.feature.people.repository.PersonRepository;
import io.mrkuhne.mezo.feature.people.service.MentionDetectionService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** TDD spec for {@link MentionDetectionService} — spec §3.2, bd mezo-06o0.1. */
class MentionDetectionServiceIT extends ApiIntegrationTest {

    @Autowired private PersonPopulator personPopulator;
    @Autowired private PersonRepository personRepository;
    @Autowired private MentionRepository mentionRepository;
    @Autowired private MentionDetectionService mentionDetectionService;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private PersonEntity personWithAliases(UUID owner, String name, List<String> aliases) {
        PersonEntity p = personPopulator.createPerson(owner, name);
        p.setAliases(aliases);
        return personRepository.saveAndFlush(p);
    }

    @Test
    void testDetect_shouldMatchNameFoldedAndAccentless() {
        UUID owner = ownerId();
        PersonEntity adam = personPopulator.createPerson(owner, "Ádám");
        UUID refId = UUID.randomUUID();
        Instant now = Instant.now();

        int written = mentionDetectionService.detect(owner, "Tegnap Adammal futottam egy jót.",
                "text", "journal_entry", refId, now);

        assertThat(written).isEqualTo(1);
        List<MentionEntity> mentions =
                mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(owner);
        assertThat(mentions).hasSize(1);
        MentionEntity m = mentions.getFirst();
        assertThat(m.getPersonId()).isEqualTo(adam.getId());
        assertThat(m.getSource()).isEqualTo("text");
        assertThat(m.getTone()).isNull();
        assertThat(m.getSourceRefKind()).isEqualTo("journal_entry");
        assertThat(m.getSourceRefId()).isEqualTo(refId);
        assertThat(m.getExcerpt()).isEqualTo("Tegnap Adammal futottam egy jót.");
    }

    @Test
    void testDetect_shouldMatchAlias() {
        UUID owner = ownerId();
        PersonEntity mark = personWithAliases(owner, "Márk", List.of("Marcika"));

        int written = mentionDetectionService.detect(owner, "Marcika átjött vacsorára.",
                "text", "journal_entry", UUID.randomUUID(), Instant.now());

        assertThat(written).isEqualTo(1);
        List<MentionEntity> mentions =
                mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(owner);
        assertThat(mentions).hasSize(1);
        assertThat(mentions.getFirst().getPersonId()).isEqualTo(mark.getId());
    }

    @Test
    void testDetect_shouldMatchHungarianSuffixedName() {
        UUID owner = ownerId();
        PersonEntity reka = personPopulator.createPerson(owner, "Réka");

        int written = mentionDetectionService.detect(owner, "Rékának segítettem a költözésben.",
                "text", "journal_entry", UUID.randomUUID(), Instant.now());

        assertThat(written).isEqualTo(1);
        List<MentionEntity> mentions =
                mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(owner);
        assertThat(mentions).hasSize(1);
        assertThat(mentions.getFirst().getPersonId()).isEqualTo(reka.getId());
    }

    @Test
    void testDetect_shouldNotMatchInsideWord() {
        UUID owner = ownerId();
        personPopulator.createPerson(owner, "Réka");

        // Folded needle "reka" IS a substring of folded "kerekarak" (from "kerékárak"), starting
        // at index 4, preceded by the letter 'e' — a genuine mid-word occurrence that only the
        // word-start guard (containsAtWordStart) rejects; a naive String.contains would match.
        int written = mentionDetectionService.detect(owner, "A kerékárak megint emelkedtek.",
                "text", "journal_entry", UUID.randomUUID(), Instant.now());

        assertThat(written).isZero();
        assertThat(mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(owner)).isEmpty();
    }

    @Test
    void testDetect_shouldPickMatchingSentenceAsExcerpt() {
        UUID owner = ownerId();
        personPopulator.createPerson(owner, "Ádám");

        int written = mentionDetectionService.detect(owner,
                "Reggel edzés volt. Ádám hívott telefonon. Este pihenés.",
                "text", "journal_entry", UUID.randomUUID(), Instant.now());

        assertThat(written).isEqualTo(1);
        List<MentionEntity> mentions =
                mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(owner);
        assertThat(mentions).hasSize(1);
        assertThat(mentions.getFirst().getExcerpt()).isEqualTo("Ádám hívott telefonon.");
    }

    @Test
    void testDetect_shouldDedupOnSecondRun() {
        UUID owner = ownerId();
        personPopulator.createPerson(owner, "Ádám");
        UUID refId = UUID.randomUUID();
        Instant now = Instant.now();
        String text = "Tegnap Adammal futottam egy jót.";

        int firstWritten = mentionDetectionService.detect(owner, text, "text", "journal_entry", refId, now);
        int secondWritten = mentionDetectionService.detect(owner, text, "text", "journal_entry", refId, now);

        assertThat(firstWritten).isEqualTo(1);
        assertThat(secondWritten).isZero();
        assertThat(mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(owner)).hasSize(1);
    }

    @Test
    void testDetect_shouldNotResurrectUndoneMention() {
        UUID owner = ownerId();
        personPopulator.createPerson(owner, "Ádám");
        UUID refId = UUID.randomUUID();
        Instant now = Instant.now();
        String text = "Tegnap Adammal futottam egy jót.";

        mentionDetectionService.detect(owner, text, "text", "journal_entry", refId, now);
        MentionEntity m = mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(owner).getFirst();
        mentionRepository.delete(m);

        int secondWritten = mentionDetectionService.detect(owner, text, "text", "journal_entry", refId, now);

        assertThat(secondWritten).isZero();
        assertThat(mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(owner)).isEmpty();
    }

    @Test
    void testDetect_shouldSkipBlankTextAndUnknownNames() {
        UUID owner = ownerId();
        personPopulator.createPerson(owner, "Ádám");

        int blank = mentionDetectionService.detect(owner, "   ", "text", "journal_entry",
                UUID.randomUUID(), Instant.now());
        int unknown = mentionDetectionService.detect(owner, "Valaki idegen járt itt.", "text",
                "journal_entry", UUID.randomUUID(), Instant.now());

        assertThat(blank).isZero();
        assertThat(unknown).isZero();
        assertThat(mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(owner)).isEmpty();
    }
}

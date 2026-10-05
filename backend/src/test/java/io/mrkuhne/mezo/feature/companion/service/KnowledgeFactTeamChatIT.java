package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * S7 (mezo-d6ivw.7): the companion's knowledge seam for the csapatfal reply — capture, mute and
 * the owner-scoped prompt read that the character feature's team-chat knowledge adapter builds on.
 */
@ActiveProfiles("companion-fake")
class KnowledgeFactTeamChatIT extends AbstractIntegrationTest {

    @Autowired private KnowledgeFactService service;
    @Autowired private KnowledgeFactRepository repository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void capture_writesAnOwnedTeamChatFact_inPrompt_withProvenance() {
        UUID owner = userPopulator.createUser().getId();
        UUID line = UUID.randomUUID();
        UUID thread = UUID.randomUUID();
        UUID id = service.captureFromTeamChat(owner, "Meccsnapokon későn eszel — ez rendben van.", "falat", line, thread);
        KnowledgeFactEntity f = repository.findByIdAndCreatedByAndDeletedFalse(id, owner).orElseThrow();
        assertThat(f.getSource()).isEqualTo("team_chat");
        assertThat(f.getOwner()).isEqualTo("falat");
        assertThat(f.getCategory()).isEqualTo("fuel");
        assertThat(f.isIncludeInPrompt()).isTrue();
        assertThat(f.getProvenance().sourceTable()).isEqualTo("team_chat_line");
        assertThat(service.renderPromptBlock(owner)).contains("Meccsnapokon későn eszel");
    }

    @Test
    void mute_takesItOutOfEveryPrompt_andNeverDeletes() {
        UUID owner = userPopulator.createUser().getId();
        UUID id = service.captureFromTeamChat(owner, "Meccsnapokon későn eszel.", "falat", UUID.randomUUID(), UUID.randomUUID());
        service.muteFromTeamChat(owner, id);
        assertThat(repository.findByIdAndCreatedByAndDeletedFalse(id, owner)).get()
                .extracting(KnowledgeFactEntity::isIncludeInPrompt).isEqualTo(false);
        // S6 final review Important 5: the user's own undo reads "te hallgattattad el" in the
        // hub — never "később nem igazolódott" (the refute reason).
        assertThat(repository.findByIdAndCreatedByAndDeletedFalse(id, owner)).get()
                .extracting(KnowledgeFactEntity::getMutedReason).isEqualTo(KnowledgeFactEntity.MUTED_USER);
        assertThat(repository.findByIdAndCreatedByAndDeletedFalse(id, owner).orElseThrow().getMutedAt()).isNotNull();
        assertThat(service.promptFactsForOwners(owner, List.of("falat"), 6)).isEmpty();
        service.muteFromTeamChat(owner, UUID.randomUUID()); // unknown id: fail-open, no throw
    }

    @Test
    void promptFactsForOwners_filtersByOwner_capsAndSkipsSuperseded() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 0; i < 8; i++) {
            service.captureFromTeamChat(owner, "Falat-tény " + i + ".", "falat", UUID.randomUUID(), UUID.randomUUID());
        }
        service.captureFromTeamChat(owner, "Szunya-tény.", "szunya", UUID.randomUUID(), UUID.randomUUID());
        // mezo-d6ivw.11: a real superseded fixture — the old version must never reach the block.
        UUID oldId = service.captureFromTeamChat(owner, "Régi szunya-tény.", "szunya", UUID.randomUUID(),
                UUID.randomUUID());
        UUID newId = service.captureFromTeamChat(owner, "Új szunya-tény.", "szunya", UUID.randomUUID(),
                UUID.randomUUID());
        KnowledgeFactEntity superseded = repository.findByIdAndCreatedByAndDeletedFalse(oldId, owner).orElseThrow();
        superseded.setSupersededBy(newId);
        repository.saveAndFlush(superseded);
        assertThat(service.promptFactsForOwners(owner, List.of("falat"), 6)).hasSize(6).allMatch(s -> s.startsWith("Falat-tény"));
        assertThat(service.promptFactsForOwners(owner, List.of("szunya"), 6))
                .containsExactlyInAnyOrder("Szunya-tény.", "Új szunya-tény.")
                .doesNotContain("Régi szunya-tény.");
    }
}

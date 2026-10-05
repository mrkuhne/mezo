package io.mrkuhne.mezo.feature.companion.service;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.KnowledgeFactProvenance;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryForgetVetoRepository;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import io.mrkuhne.mezo.feature.people.service.PersonFactService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;

/**
 * „Rólam is" (mezo-d6ivw.13): a chat person fact copied into the user's own knowledge facts —
 * one live copy, removed without a veto, re-creatable, and gone when the person fact is undone.
 * No class-level {@code @Transactional}: the undo cascade is an AFTER_COMMIT listener.
 */
@RecordApplicationEvents
class AboutMeServiceIT extends AbstractIntegrationTest {

    @Autowired private AboutMeService aboutMeService;
    @Autowired private PersonFactService personFactService;
    @Autowired private KnowledgeFactService knowledgeFactService;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;
    @Autowired private MemoryForgetVetoRepository vetoRepository;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private AiMessagePopulator messages;
    @Autowired private PersonPopulator persons;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private ApplicationEvents events;

    private record Fixture(UUID userId, PersonEntity dori, PersonFactEntity fact) {}

    private Fixture fixture(String email, String text) {
        UUID userId = databasePopulator.populateUser(email);
        AiConversationEntity conversation = conversations.conversation(userId);
        AiMessageEntity turn = messages.message(conversation, AiMessageEntity.ROLE_USER, "Dórival jól vagyunk");
        PersonEntity dori = persons.createPerson(userId, "Dóri");
        PersonFactEntity fact = personFactService.capture(userId, PersonFactEntity.SOURCE_CHAT_TURN,
                turn.getId().toString(), List.of(new PersonFactService.PersonFactCapture(dori.getId(),
                        PersonFactEntity.KIND_RELATIONSHIP_STATE, text, "high"))).getFirst();
        return new Fixture(userId, dori, fact);
    }

    private List<KnowledgeFactEntity> live(UUID userId) {
        return knowledgeFactRepository.findByCreatedByAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(userId);
    }

    @Test
    void testAdd_shouldCopyThePersonFactOnce_asAMezoLifeFact_andPublishTheChange() {
        Fixture f = fixture("aboutme-add@test.local", "Dóri mellett nem kell megjátszanom magam.");

        UUID first = aboutMeService.add(f.userId(), f.fact().getId());
        UUID second = aboutMeService.add(f.userId(), f.fact().getId());

        assertThat(second).isEqualTo(first);
        assertThat(live(f.userId())).singleElement().satisfies(k -> {
            assertThat(k.getId()).isEqualTo(first);
            assertThat(k.getFactText()).isEqualTo("Dóri mellett nem kell megjátszanom magam.");
            assertThat(k.getSource()).isEqualTo(KnowledgeFactEntity.SOURCE_PERSON_FACT);
            assertThat(k.getOwner()).isEqualTo("mezo");
            assertThat(k.getCategory()).isEqualTo("life");
            assertThat(k.getSourcePersonFactId()).isEqualTo(f.fact().getId());
            assertThat(k.isIncludeInPrompt()).isTrue();
        });
        assertThat(events.stream(KnowledgeFactChangedEvent.class)).anyMatch(e -> e.factId().equals(first));
    }

    @Test
    void testAdd_shouldPrefixTheName_whenTheTextDoesNotNameThePerson() {
        Fixture f = fixture("aboutme-prefix@test.local", "tavasz óta a strandröpi-párod");

        aboutMeService.add(f.userId(), f.fact().getId());

        assertThat(live(f.userId())).singleElement()
                .extracting(KnowledgeFactEntity::getFactText).isEqualTo("Dóri: tavasz óta a strandröpi-párod");
    }

    @Test
    void testAdd_shouldKeepTheText_whenTheNameIsInflected() {
        Fixture f = fixture("aboutme-inflected@test.local", "Dórival egyre komfortosabbak vagyunk.");

        aboutMeService.add(f.userId(), f.fact().getId());

        assertThat(live(f.userId())).singleElement()
                .extracting(KnowledgeFactEntity::getFactText).isEqualTo("Dórival egyre komfortosabbak vagyunk.");
    }

    @Test
    void testRemove_shouldSoftDeleteTheCopyWithoutAVeto_andAReTapCreatesItAgain() {
        Fixture f = fixture("aboutme-remove@test.local", "Dóri mellett nem kell megjátszanom magam.");
        UUID copy = aboutMeService.add(f.userId(), f.fact().getId());

        aboutMeService.remove(f.userId(), f.fact().getId());

        assertThat(live(f.userId())).isEmpty();
        assertThat(knowledgeFactRepository.findById(copy)).isEmpty(); // @SQLRestriction hides the soft-deleted row
        assertThat(vetoRepository.findAll()).noneMatch(v -> f.userId().equals(v.getCreatedBy()));
        assertThat(events.stream(KnowledgeFactChangedEvent.class).filter(e -> e.factId().equals(copy))).hasSize(2);
        assertThat(aboutMeService.aboutMeFactIds(f.userId(), List.of(f.fact().getId()))).isEmpty();

        UUID again = aboutMeService.add(f.userId(), f.fact().getId());

        assertThat(again).isNotEqualTo(copy);
        assertThat(live(f.userId())).extracting(KnowledgeFactEntity::getId).containsExactly(again);
        assertThat(aboutMeService.aboutMeFactIds(f.userId(), List.of(f.fact().getId())))
                .containsEntry(f.fact().getId(), again);
    }

    @Test
    void testRemove_shouldBeANoOp_whenThereIsNoCopy() {
        Fixture f = fixture("aboutme-remove-none@test.local", "Dóri mellett nem kell megjátszanom magam.");

        aboutMeService.remove(f.userId(), f.fact().getId());

        assertThat(live(f.userId())).isEmpty();
    }

    @Test
    void testAdd_shouldReturn404_forAForeignOrAnUndonePersonFact() {
        Fixture f = fixture("aboutme-404@test.local", "Dóri mellett nem kell megjátszanom magam.");
        UUID stranger = databasePopulator.populateUser("aboutme-404-stranger@test.local");

        assertThatThrownBy(() -> aboutMeService.add(stranger, f.fact().getId()))
                .isInstanceOf(SystemRuntimeErrorException.class);
        personFactService.undo(f.userId(), f.dori().getId(), f.fact().getId());
        assertThatThrownBy(() -> aboutMeService.add(f.userId(), f.fact().getId()))
                .isInstanceOf(SystemRuntimeErrorException.class);
        assertThat(live(stranger)).isEmpty();
        assertThat(live(f.userId())).isEmpty();
    }

    @Test
    void testPersonFactUndo_shouldRemoveTheCopy() {
        Fixture f = fixture("aboutme-undo-cascade@test.local", "Dóri mellett nem kell megjátszanom magam.");
        aboutMeService.add(f.userId(), f.fact().getId());

        personFactService.undo(f.userId(), f.dori().getId(), f.fact().getId());

        await().atMost(10, SECONDS).untilAsserted(() -> assertThat(live(f.userId())).isEmpty());
    }

    @Test
    void testList_shouldShowThePersonFactCopyInTheTudastar() {
        Fixture f = fixture("aboutme-list@test.local", "Dóri mellett nem kell megjátszanom magam.");
        aboutMeService.add(f.userId(), f.fact().getId());

        assertThat(knowledgeFactService.list(f.userId())).singleElement().satisfies(r -> {
            assertThat(r.getSource()).isEqualTo("person_fact");
            assertThat(r.getProvenance().getSourceKind()).isEqualTo(KnowledgeFactProvenance.SourceKindEnum.PERSON_FACT);
        });
    }
}

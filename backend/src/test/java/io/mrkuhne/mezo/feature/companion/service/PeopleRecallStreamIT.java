package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.RecalledMemoriesEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import io.mrkuhne.mezo.feature.people.service.PersonFactService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * S8 (mezo-d6ivw.12): the STREAMED twin of {@link PeopleRecallIT} — the people disclosure rides
 * PreparedTurn.recalled into completeTurn and lands on the persisted assistant row. Not
 * {@code @Transactional}: the stream runs on another thread (ConversationFirstIT precedent).
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.conversation.enabled=true")
class PeopleRecallStreamIT extends AbstractIntegrationTest {

    private static final String NO_DATA = " [fake-plan:{\"needsData\":false,\"steps\":[]}]";

    @Autowired private ChatStreamService streamService;
    @Autowired private PersonFactService personFactService;
    @Autowired private AiMessageRepository messageRepository;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private PersonPopulator persons;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testStreamMessage_shouldPersistThePeopleDisclosure_whenNamed() {
        UUID userId = databasePopulator.populateUser("s8-recall-stream@test.local");
        AiConversationEntity conversation = conversations.conversation(userId);
        PersonEntity dori = persons.createPerson(userId, "Dóri");
        personFactService.capture(userId, PersonFactEntity.SOURCE_NIGHTLY_DAY, "2026-09-26", List.of(
                new PersonFactService.PersonFactCapture(dori.getId(), PersonFactEntity.KIND_RELATIONSHIP_STATE,
                        "tavasz óta a strandröpi-párod", "high")));

        var events = streamService.streamMessage(userId, conversation.getId(),
                SendMessageRequest.builder().content("Dórival nyertünk ma!" + NO_DATA).build())
                .collectList().block(Duration.ofSeconds(30));

        assertThat(events).isNotNull();
        assertThat(events.getLast().event()).isEqualTo("done");
        MessageResponse done = (MessageResponse) events.getLast().data();
        assertThat(done.getRecalled()).filteredOn(r -> "person".equals(r.getKind()))
                .singleElement().satisfies(r -> assertThat(r.getLabel()).isEqualTo("Dóri"));
        AiMessageEntity row = messageRepository.findById(done.getId()).orElseThrow();
        assertThat(RecalledMemoriesEnvelope.personItems(row.getRecalledMemories()))
                .extracting(RecalledMemoriesEnvelope.Item::refId).containsExactly(dori.getId());
    }
}

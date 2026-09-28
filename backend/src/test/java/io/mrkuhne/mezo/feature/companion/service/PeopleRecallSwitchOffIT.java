package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import io.mrkuhne.mezo.feature.people.service.PersonFactService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

/** S8 (mezo-d6ivw.12): switch off ⇒ the turn assembles exactly as before — no block, no disclosure. */
@Transactional
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
        "mezo.companion.conversation.enabled=true",
        "mezo.companion.people-recall.enabled=false"})
class PeopleRecallSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private PersonFactService personFactService;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private PersonPopulator persons;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testSendMessage_shouldNeitherInjectNorDisclose_whenPeopleRecallIsOff() {
        UUID userId = databasePopulator.populateUser("s8-recall-off@test.local");
        AiConversationEntity conversation = conversations.conversation(userId);
        PersonEntity dori = persons.createPerson(userId, "Dóri");
        persons.createPerson(userId, "Bence");
        personFactService.capture(userId, PersonFactEntity.SOURCE_NIGHTLY_DAY, "2026-09-26", List.of(
                new PersonFactService.PersonFactCapture(dori.getId(), PersonFactEntity.KIND_RELATIONSHIP_STATE,
                        "tavasz óta a strandröpi-párod", "high")));

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(),
                SendMessageRequest.builder().content("Dórival és Bencével nyertünk ma!").build());

        assertThat(answer.getContent()).doesNotContain("(az üzenetben említettek)");
        assertThat(answer.getRecalled()).noneMatch(r -> "person".equals(r.getKind()));
    }
}

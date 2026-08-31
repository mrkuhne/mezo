package io.mrkuhne.mezo.feature.people;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.CreateJournalEntryRequest;
import io.mrkuhne.mezo.api.dto.CreatePersonRequest;
import io.mrkuhne.mezo.api.dto.JournalEntryResponse;
import io.mrkuhne.mezo.api.dto.PersonResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.feature.people.service.MentionDetectionListener;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * PEOPLE_SWITCH off ⇒ no {@code MentionDetectionListener} bean exists and no narrative-source
 * text ever produces a mention, even with a well-known person name in the text. The
 * {@code TurnEmbeddingSwitchOffIT} idiom.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.feature.people.enabled=false")
class MentionDetectionSwitchOffIT extends ApiIntegrationTest {

    @Autowired private ApplicationContext context;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private MentionRepository mentionRepository;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testContext_shouldHaveNoListenerBean_whenPeopleOff() {
        assertThat(context.getBeansOfType(MentionDetectionListener.class)).isEmpty();
    }

    @Test
    void testJournalSave_shouldWriteNoMention_whenPeopleOff() {
        UUID owner = ownerId();

        CreatePersonRequest personReq = new CreatePersonRequest();
        personReq.setName("Ádám");
        personReq.setRelationship(CreatePersonRequest.RelationshipEnum.FRIEND);
        personReq.setRelationshipHu("Barát");
        postForBody("/api/people", personReq, ownerAuthHeaders(), HttpStatus.CREATED, PersonResponse.class);

        postForBody("/api/journal",
                CreateJournalEntryRequest.builder()
                        .text("Ádámmal kávéztunk délután.")
                        .occurredOn(LocalDate.parse("2026-08-15"))
                        .source("quickinput")
                        .build(),
                ownerAuthHeaders(), HttpStatus.CREATED, JournalEntryResponse.class);

        await().during(2, SECONDS).atMost(6, SECONDS).untilAsserted(() ->
                assertThat(mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(owner))
                        .isEmpty());
    }
}

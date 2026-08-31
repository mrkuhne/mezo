package io.mrkuhne.mezo.feature.people;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.CreateDecisionEntryRequest;
import io.mrkuhne.mezo.api.dto.CreateGratitudeEntryRequest;
import io.mrkuhne.mezo.api.dto.CreateJournalEntryRequest;
import io.mrkuhne.mezo.api.dto.CreatePersonRequest;
import io.mrkuhne.mezo.api.dto.DecisionEntryResponse;
import io.mrkuhne.mezo.api.dto.GratitudeEntryResponse;
import io.mrkuhne.mezo.api.dto.JournalEntryResponse;
import io.mrkuhne.mezo.api.dto.PersonResponse;
import io.mrkuhne.mezo.api.dto.UpdateJournalEntryRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * End-to-end acceptance test of the S2 narrative-source mention pipeline (bd mezo-06o0.1):
 * POST /api/journal|gratitude|decision -> AFTER_COMMIT event -> async {@code
 * MentionDetectionListener} -> {@code MentionDetectionService.detect} -> exactly ONE
 * {@code mention} row per (person, source-ref). The {@code JournalEmbeddingEventIT} idiom: NOT
 * {@code @Transactional} so the server-side commit really happens and AFTER_COMMIT genuinely
 * fires, Awaitility rides out the async hop.
 */
@ActiveProfiles("companion-fake")
class MentionDetectionListenerIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private MentionRepository mentionRepository;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private void createPerson(String name) {
        CreatePersonRequest req = new CreatePersonRequest();
        req.setName(name);
        req.setRelationship(CreatePersonRequest.RelationshipEnum.FRIEND);
        req.setRelationshipHu("Barát");
        postForBody("/api/people", req, ownerAuthHeaders(), HttpStatus.CREATED, PersonResponse.class);
    }

    private List<MentionEntity> mentionsFor(UUID owner) {
        return mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(owner);
    }

    @Test
    void testJournalSave_shouldWriteMention() {
        UUID owner = ownerId();
        createPerson("Ádám");

        JournalEntryResponse created = postForBody("/api/journal",
                CreateJournalEntryRequest.builder()
                        .text("Ádámmal kávéztunk délután.")
                        .occurredOn(LocalDate.parse("2026-08-15"))
                        .source("quickinput")
                        .build(),
                ownerAuthHeaders(), HttpStatus.CREATED, JournalEntryResponse.class);

        await().atMost(5, SECONDS).untilAsserted(() -> {
            List<MentionEntity> mentions = mentionsFor(owner);
            assertThat(mentions).hasSize(1);
            MentionEntity m = mentions.getFirst();
            assertThat(m.getSource()).isEqualTo("text");
            assertThat(m.getSourceRefKind()).isEqualTo("journal_entry");
            assertThat(m.getSourceRefId()).isEqualTo(created.getId());
            assertThat(m.getTone()).isNull();
            assertThat(m.getExcerpt()).isEqualTo("Ádámmal kávéztunk délután.");
        });
    }

    @Test
    void testJournalEdit_shouldNotDuplicateMention() {
        UUID owner = ownerId();
        createPerson("Ádám");

        JournalEntryResponse created = postForBody("/api/journal",
                CreateJournalEntryRequest.builder()
                        .text("Ádámmal kávéztunk délután.")
                        .occurredOn(LocalDate.parse("2026-08-15"))
                        .source("quickinput")
                        .build(),
                ownerAuthHeaders(), HttpStatus.CREATED, JournalEntryResponse.class);

        await().atMost(5, SECONDS).untilAsserted(() -> assertThat(mentionsFor(owner)).hasSize(1));

        putForBody("/api/journal/" + created.getId(),
                UpdateJournalEntryRequest.builder().text("Ádámmal ma is kávéztunk.").build(),
                ownerAuthHeaders(), HttpStatus.OK, JournalEntryResponse.class);

        await().during(2, SECONDS).atMost(6, SECONDS)
                .untilAsserted(() -> assertThat(mentionsFor(owner)).hasSize(1));
    }

    @Test
    void testGratitudeSave_shouldWriteMention() {
        UUID owner = ownerId();
        createPerson("Réka");

        var req = new CreateGratitudeEntryRequest();
        req.setText("Rékának köszönöm a segítséget.");
        req.setOccurredOn(LocalDate.parse("2026-08-15"));

        GratitudeEntryResponse created = postForBody("/api/journal/gratitude", req,
                ownerAuthHeaders(), HttpStatus.CREATED, GratitudeEntryResponse.class);

        await().atMost(5, SECONDS).untilAsserted(() -> {
            List<MentionEntity> mentions = mentionsFor(owner);
            assertThat(mentions).hasSize(1);
            MentionEntity m = mentions.getFirst();
            assertThat(m.getSource()).isEqualTo("text");
            assertThat(m.getSourceRefKind()).isEqualTo("gratitude");
            assertThat(m.getSourceRefId()).isEqualTo(created.getId());
        });
    }

    @Test
    void testDecisionSave_shouldWriteMention() {
        UUID owner = ownerId();
        createPerson("Márk");

        DecisionEntryResponse created = postForBody("/api/journal/decision",
                CreateDecisionEntryRequest.builder()
                        .decisionText("Márkkal beszéltem a projektről.")
                        .decidedOn(LocalDate.parse("2026-08-20"))
                        .build(),
                ownerAuthHeaders(), HttpStatus.CREATED, DecisionEntryResponse.class);

        await().atMost(5, SECONDS).untilAsserted(() -> {
            List<MentionEntity> mentions = mentionsFor(owner);
            assertThat(mentions).hasSize(1);
            MentionEntity m = mentions.getFirst();
            assertThat(m.getSource()).isEqualTo("text");
            assertThat(m.getSourceRefKind()).isEqualTo("decision");
            assertThat(m.getSourceRefId()).isEqualTo(created.getId());
        });
    }
}

package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.embedding.MemoryEmbeddingWriter;
import io.mrkuhne.mezo.feature.companion.embedding.NoteEmbeddingCatchUp;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.repository.DenseMemoryQuery;
import io.mrkuhne.mezo.feature.companion.memory.repository.LexicalMemoryQuery;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemorySourceRepairQuery;
import io.mrkuhne.mezo.feature.companion.reflection.service.ObservationContextService;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.feature.companion.repository.PersonalRecordQuery;
import io.mrkuhne.mezo.feature.companion.repository.PersonalRecordSource;
import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.MentionPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * mezo-tdabt (S8 follow-up): "ezt ne jegyezd meg" really forgets. A chat turn whose USER message is
 * {@code extraction_blocked} disappears from every memory channel — unified recall (lexical, dense),
 * the personal-record reads (LLM tool + reflection evidence), the repair sweep, the legacy turn
 * embedding, and the people mentions (hence the daily summary) — while an unforgotten turn stays.
 *
 * <p>Not {@code @Transactional}: the catch-up sweep and the forget commit their own transactions.
 */
@ActiveProfiles("companion-fake")
class ChatForgetRecallIT extends AbstractIntegrationTest {

    @Autowired private ChatForgetService chatForgetService;
    @Autowired private NoteEmbeddingCatchUp catchUp;
    @Autowired private LexicalMemoryQuery lexical;
    @Autowired private DenseMemoryQuery dense;
    @Autowired private MemoryItemRepository items;
    @Autowired private MemorySourceRepairQuery repairQuery;
    @Autowired private MemoryPlatformProperties platformProperties;
    @Autowired private PersonalRecordQuery records;
    @Autowired private ObservationContextService observationContext;
    @Autowired private MemoryEmbeddingWriter memoryEmbeddingWriter;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;
    @Autowired private MentionRepository mentionRepository;
    @Autowired private DailySummaryService dailySummaryService;
    @Autowired private UserPopulator users;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private AiMessagePopulator messages;
    @Autowired private PersonPopulator persons;
    @Autowired private MentionPopulator mentions;
    @Autowired private JdbcTemplate jdbc;

    private record Turn(AiConversationEntity conversation, AiMessageEntity user, AiMessageEntity assistant) {}

    private Turn turn(UUID owner, String userText, String assistantText) {
        AiConversationEntity conversation = conversations.conversation(owner);
        AiMessageEntity user = messages.message(conversation, AiMessageEntity.ROLE_USER, userText);
        AiMessageEntity assistant = messages.message(conversation, AiMessageEntity.ROLE_ASSISTANT, assistantText);
        return new Turn(conversation, user, assistant);
    }

    private MemoryItemEntity itemOf(UUID owner, AiMessageEntity assistant) {
        return items.findByCreatedByAndSourceKindAndSourceIdOrderByChunkIndex(owner, "chat_turn", assistant.getId())
                .getFirst();
    }

    private String vectorOf(MemoryItemEntity item) {
        return jdbc.queryForObject("select embedding::text from memory_vector where memory_item_id = ? and not is_deleted",
                String.class, item.getId());
    }

    @Test
    void testRecall_shouldHideTheForgottenTurn_andKeepTheOtherTurn_whenItsUserMessageIsBlocked() {
        UUID owner = users.createUser().getId();
        LocalDate today = LocalDate.now();
        Turn secret = turn(owner, "Titkos kajaktúra a Balatonon", "A kajaktúra izgalmasan hangzik.");
        Turn kept = turn(owner, "Hegymászás a Tátrában", "A hegymászás remek ötlet.");
        catchUp.run(owner, today);
        assertThat(lexical.search(owner, "kajaktúra", today, null, 30, null)).isNotEmpty();
        String secretVector = vectorOf(itemOf(owner, secret.assistant()));
        String keptVector = vectorOf(itemOf(owner, kept.assistant()));

        chatForgetService.forgetLatest(owner, secret.conversation().getId());

        // unified recall: lexical + dense
        assertThat(lexical.search(owner, "kajaktúra", today, null, 30, null)).isEmpty();
        assertThat(lexical.search(owner, "hegymászás", today, null, 30, null))
                .extracting(LexicalMemoryQuery.Hit::sourceId).containsExactly(kept.assistant().getId());
        String version = platformProperties.servingEmbeddingVersion();
        assertThat(dense.nearest(owner, secretVector, version, today, null, 30, null))
                .extracting(DenseMemoryQuery.Hit::sourceId).doesNotContain(secret.assistant().getId());
        assertThat(dense.nearest(owner, keptVector, version, today, null, 30, null))
                .extracting(DenseMemoryQuery.Hit::sourceId).contains(kept.assistant().getId());
        // personal-record reads: the memory_item projection and the raw messages (user + paired reply)
        assertThat(records.read(owner, PersonalRecordSource.named("memory_item"), null, null, null, null,
                "kajaktúra", 0, 50)).isEmpty();
        assertThat(records.read(owner, PersonalRecordSource.named("ai_message"), null, null, null, null,
                "kajaktúra", 0, 50)).isEmpty();
        assertThat(records.read(owner, PersonalRecordSource.named("ai_message"), null, null, null, null,
                "hegymászás", 0, 50)).extracting(PersonalRecordQuery.Row::id)
                .containsExactlyInAnyOrder(kept.user().getId(), kept.assistant().getId());
        // reflection evidence
        var evidence = observationContext.collect(owner, today);
        assertThat(evidence.text()).doesNotContain("kajaktúra").contains("Hegymászás a Tátrában");
        assertThat(observationContext.exists(owner, "ai_message:" + secret.user().getId())).isFalse();
    }

    @Test
    void testRepair_shouldRetireTheForgottenTurnItem_andNeverReprojectIt_whenTheSweepRuns() {
        UUID owner = users.createUser().getId();
        LocalDate today = LocalDate.now();
        Turn secret = turn(owner, "Titkos kajaktúra", "Rendben.");
        Turn kept = turn(owner, "Hegymászás", "Szuper.");
        catchUp.run(owner, today);

        chatForgetService.forgetLatest(owner, secret.conversation().getId());
        assertThat(repairQuery.orphaned(owner, 50)).extracting(MemorySourceRepairQuery.Source::id)
                .containsExactly(secret.assistant().getId());
        catchUp.run(owner, today);

        assertThat(itemOf(owner, secret.assistant()).getState()).isEqualTo("suppressed");
        assertThat(itemOf(owner, kept.assistant()).getState()).isEqualTo("active");
        assertThat(repairQuery.changed(owner, today, platformProperties.servingEmbeddingVersion(), 50))
                .extracting(MemorySourceRepairQuery.Source::id).doesNotContain(secret.assistant().getId());
        assertThat(repairQuery.orphaned(owner, 50)).isEmpty();
    }

    @Test
    void testEmbedTurn_shouldSkipTheLegacyEmbedding_whenThePairedUserMessageIsBlocked() {
        UUID owner = users.createUser().getId();
        Turn secret = turn(owner, "Titkos kajaktúra", "Rendben.");
        Turn kept = turn(owner, "Hegymászás", "Szuper.");
        chatForgetService.forgetLatest(owner, secret.conversation().getId());

        memoryEmbeddingWriter.embedTurnByMessageId(secret.assistant().getId());
        memoryEmbeddingWriter.embedTurnByMessageId(kept.assistant().getId());

        assertThat(memoryEmbeddingRepository.existsByKindAndRefId(MemoryEmbeddingEntity.KIND_CHAT_TURN,
                secret.assistant().getId())).isFalse();
        assertThat(memoryEmbeddingRepository.existsByKindAndRefId(MemoryEmbeddingEntity.KIND_CHAT_TURN,
                kept.assistant().getId())).isTrue();
    }

    @Test
    void testForgetLatest_shouldSoftDeleteTheForgottenMessagesMentions_andDropThemFromTheDailySummary() {
        UUID owner = users.createUser().getId();
        LocalDate today = LocalDate.now();
        PersonEntity adam = persons.createPerson(owner, "Ádám");
        Turn older = turn(owner, "Ádám segített költözni.", "De jó.");
        Turn secret = turn(owner, "Ádámmal összevesztünk a pénzen.", "Sajnálom.");
        // the other conversation's older message is not the forget target
        MentionEntity kept = mentions.createChatMention(owner, adam.getId(), Instant.now(),
                "Ádám segített költözni.", older.user().getId());
        MentionEntity forgotten = mentions.createChatMention(owner, adam.getId(), Instant.now(),
                "Ádámmal összevesztünk a pénzen.", secret.user().getId());

        chatForgetService.forgetLatest(owner, secret.conversation().getId());

        assertThat(mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(owner))
                .extracting(MentionEntity::getId).containsExactly(kept.getId());
        assertThat(mentionRepository.findById(forgotten.getId())).isEmpty(); // @SQLRestriction: soft-deleted
        DailySummaryEntity summary = dailySummaryService.generate(owner, today);
        assertThat(summary.getNarrative()).contains("Ádám segített költözni.").doesNotContain("összevesztünk");
    }

    @Test
    void testForgetAll_shouldSoftDeleteTheMentionsOfEveryUserMessageOfTheConversation() {
        UUID owner = users.createUser().getId();
        PersonEntity adam = persons.createPerson(owner, "Ádám");
        Turn first = turn(owner, "Ádám átjött.", "Jó.");
        AiMessageEntity second = messages.message(first.conversation(), AiMessageEntity.ROLE_USER, "Ádám maradt vacsorára.");
        AiMessageEntity trigger = messages.message(first.conversation(), AiMessageEntity.ROLE_USER, "ezt ne jegyezd meg");
        Turn elsewhere = turn(owner, "Ádám hívott.", "Oké.");
        mentions.createChatMention(owner, adam.getId(), Instant.now(), "Ádám átjött.", first.user().getId());
        mentions.createChatMention(owner, adam.getId(), Instant.now(), "Ádám maradt vacsorára.", second.getId());
        MentionEntity kept = mentions.createChatMention(owner, adam.getId(), Instant.now(), "Ádám hívott.",
                elsewhere.user().getId());

        chatForgetService.forgetAll(owner, first.conversation().getId(), trigger.getId());

        List<MentionEntity> live = mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(owner);
        assertThat(live).extracting(MentionEntity::getId).containsExactly(kept.getId());
    }
}

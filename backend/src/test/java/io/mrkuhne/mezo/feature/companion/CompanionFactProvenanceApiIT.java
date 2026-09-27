package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.KnowledgeFactResponse;
import io.mrkuhne.mezo.api.dto.ObservationEvidenceItem;
import io.mrkuhne.mezo.api.dto.UpdateFactRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.feature.companion.service.PatternService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.LearnedFactPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** S6 (mezo-d6ivw.6) Task A3: the fact list says where each fact came from and why it is muted. */
class CompanionFactProvenanceApiIT extends ApiIntegrationTest {

    private static final String FACTS = "/api/companion/fact";

    @Autowired private KnowledgeFactPopulator factPopulator;
    @Autowired private LearnedFactPopulator learnedFactPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private KnowledgeFactRepository factRepository;
    @Autowired private LearnedFactRepository learnedFactRepository;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private AiMessagePopulator messagePopulator;

    @Test
    void list_shouldCarryChatSourceMessage_andPatternId() {
        RegisteredUser user = registerUser("s6-provenance");
        UUID owner = user.id();
        HttpHeaders headers = user.headers();
        AiConversationEntity conversation = conversationPopulator.conversation(owner);
        AiMessageEntity message = messagePopulator.message(conversation, "user", "Laktózérzékeny vagyok");
        UUID messageId = message.getId();
        KnowledgeFactEntity chat = factPopulator.fact(owner, "Laktózérzékeny vagy", "fuel", 1, true,
                KnowledgeFactEntity.SOURCE_CHAT);
        LearnedFactEntity candidate = learnedFactPopulator.candidate(owner, "Laktózérzékeny vagy", messageId);
        candidate.setUserDecision(LearnedFactEntity.DECISION_ACCEPT);
        candidate.setPromotedFactId(chat.getId());
        learnedFactRepository.saveAndFlush(candidate);

        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_CONFIRMED);
        KnowledgeFactEntity fromPattern = factPopulator.fact(owner, row.getTitle(), "health", 0, true,
                KnowledgeFactEntity.SOURCE_PATTERN);
        fromPattern.setProvenance(MemoryProvenanceEnvelope.patternPromotion(row.getId(), PatternService.CONFIRM_SOURCE_USER));
        factRepository.saveAndFlush(fromPattern);

        List<KnowledgeFactResponse> facts = getForList(FACTS, headers, HttpStatus.OK, KnowledgeFactResponse.class);

        KnowledgeFactResponse c = facts.stream().filter(f -> f.getId().equals(chat.getId())).findFirst().orElseThrow();
        assertThat(c.getProvenance().getSourceKind().getValue()).isEqualTo("chat");
        assertThat(c.getProvenance().getSourceMessageId()).isEqualTo(messageId);
        assertThat(c.getMutedReason()).isNull();

        KnowledgeFactResponse p = facts.stream().filter(f -> f.getId().equals(fromPattern.getId())).findFirst().orElseThrow();
        assertThat(p.getProvenance().getPatternId()).isEqualTo(row.getId());
    }

    @Test
    void patch_shouldReturnUserMuteReason_andAcceptEnumCategory() {
        RegisteredUser user = registerUser("s6-mute");
        UUID owner = user.id();
        HttpHeaders headers = user.headers();
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Esti futás", "train", 0);

        KnowledgeFactResponse muted = patchForBody(FACTS + "/" + fact.getId(),
                UpdateFactRequest.builder().includeInPrompt(false).category(UpdateFactRequest.CategoryEnum.LIFE).build(),
                headers, HttpStatus.OK, KnowledgeFactResponse.class);

        assertThat(muted.getMutedReason().getValue()).isEqualTo("user");
        assertThat(muted.getMutedAt()).isNotNull();
        assertThat(muted.getCategory()).isEqualTo("life");
    }

    /** Final-review Critical 1: an S7 csapatfal fact (source team_chat) must not 500 the list,
     *  and its "Honnan tudom?" has no evidence to show. */
    @Test
    void list_shouldCarryTeamChatSource_andEvidenceIsEmpty() {
        RegisteredUser user = registerUser("s6-team-chat");
        HttpHeaders headers = user.headers();
        KnowledgeFactEntity teamChat = factPopulator.fact(user.id(), "Hétfőn edzés helyett úszol", "train", 0, true,
                KnowledgeFactEntity.SOURCE_TEAM_CHAT);

        List<KnowledgeFactResponse> facts = getForList(FACTS, headers, HttpStatus.OK, KnowledgeFactResponse.class);

        KnowledgeFactResponse t = facts.stream().filter(f -> f.getId().equals(teamChat.getId())).findFirst().orElseThrow();
        assertThat(t.getProvenance().getSourceKind().getValue()).isEqualTo("team_chat");
        List<ObservationEvidenceItem> evidence = getForList(FACTS + "/" + teamChat.getId() + "/evidence", headers,
                HttpStatus.OK, ObservationEvidenceItem.class);
        assertThat(evidence).isEmpty();
    }
}

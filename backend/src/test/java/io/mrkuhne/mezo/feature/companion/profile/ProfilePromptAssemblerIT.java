package io.mrkuhne.mezo.feature.companion.profile;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.profile.service.ProfileAssembler;
import io.mrkuhne.mezo.feature.companion.profile.service.ProfilePromptAssembler;
import io.mrkuhne.mezo.feature.companion.service.ChatService;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.GraphPopulator;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * W4.3 (mezo-b3pp.17): the injected [Rólad tanultam] block — present, capped, empty once
 * archived, and correctly positioned (after the fact blocks, before [Emlékek]) on a real turn.
 */
@ActiveProfiles("companion-fake")
class ProfilePromptAssemblerIT extends AbstractIntegrationTest {

    @Autowired
    private ProfilePromptAssembler assembler;
    @Autowired
    private GraphNodeRepository nodeRepository;
    @Autowired
    private GraphPopulator graphPopulator;
    @Autowired
    private DatabasePopulator databasePopulator;
    @Autowired
    private AiConversationPopulator conversationPopulator;
    @Autowired
    private MemoryEmbeddingPopulator memoryEmbeddingPopulator;
    @Autowired
    private KnowledgeFactPopulator knowledgeFactPopulator;
    @Autowired
    private ChatService chatService;

    private GraphNodeEntity seedProfile(UUID owner, String prose) {
        return graphPopulator.createSourcedNode(owner, GraphNodeEntity.KIND_INSIGHT,
                ProfileAssembler.PROFILE_TITLE, prose, ProfileAssembler.SOURCE_PROFILE, owner);
    }

    @Test
    void renders_the_header_and_the_prose() {
        UUID owner = databasePopulator.populateUser("profile-prompt-render@test.local");
        seedProfile(owner, "A rövid reggeli üzenet válik be nálad.");

        String block = assembler.render(owner);

        assertThat(block).startsWith(ProfilePromptAssembler.PROFILE_HEADER)
                .contains("A rövid reggeli üzenet válik be nálad.");
    }

    @Test
    void no_profile_means_an_empty_block() {
        UUID owner = databasePopulator.populateUser("profile-prompt-none@test.local");

        assertThat(assembler.render(owner)).isEmpty();
    }

    @Test
    void an_archived_profile_empties_the_block() {
        UUID owner = databasePopulator.populateUser("profile-prompt-archived@test.local");
        GraphNodeEntity node = seedProfile(owner, "A rövid reggeli üzenet válik be nálad.");
        node.setStatus(GraphNodeEntity.STATUS_ARCHIVED);
        nodeRepository.saveAndFlush(node);

        assertThat(assembler.render(owner)).isEmpty();
    }

    @Test
    void the_block_stays_under_the_token_cap_even_for_an_oversized_row() {
        UUID owner = databasePopulator.populateUser("profile-prompt-cap@test.local");
        seedProfile(owner, "szó ".repeat(2000));

        // Spec §8.3: the WHOLE block — header included — must fit under 400 tokens, not the header
        // plus a full 400-token prose on top of it (review fix, mezo-b3pp.17).
        assertThat(assembler.render(owner).length()).isLessThanOrEqualTo(400 * 3);
    }

    /**
     * No production test seam was added (per the review's ambiguity resolution) — instead this
     * pins the block's POSITION the same way {@code ChatServiceGraphBlockIT} pins [Összefüggések]:
     * a real turn through {@link ChatService#prepareTurn}, asserting on its {@code systemPrompt()}.
     */
    @Test
    void the_chat_prompt_carries_the_block_after_the_fact_blocks_and_before_memories() {
        UUID owner = databasePopulator.populateUser("profile-prompt-order@test.local");
        seedProfile(owner, "A rövid reggeli üzenet válik be nálad.");
        knowledgeFactPopulator.fact(owner, "Reggel fut, ha teheti.", "train", 3);
        AiConversationEntity conversation = conversationPopulator.conversation(owner);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, UUID.randomUUID(),
                "futás után jobban aludtam", LocalDate.now().minusDays(3), MemoryEmbeddingPopulator.axisVector(0));

        ChatService.PreparedTurn turn = chatService.prepareTurn(owner, conversation.getId(),
                SendMessageRequest.builder().content("[fake-embed:1] mi a mai terv?").build());

        String prompt = turn.systemPrompt();
        String factsHeader = KnowledgeFactService.FACTS_HEADER
                .replace(PromptPersona.NAME_TOKEN, "profile-prompt-order@test.local");
        assertThat(prompt).contains(ProfilePromptAssembler.PROFILE_HEADER);
        // Guard (review fix): both ends of the ordering comparison must be real hits, not -1 —
        // an unseeded facts/memories block would make isGreaterThan/isLessThan vacuously true.
        assertThat(prompt.indexOf(factsHeader)).isPositive();
        assertThat(prompt.indexOf(PromptMemoryAssembler.MEMORIES_HEADER)).isPositive();
        assertThat(prompt.indexOf(ProfilePromptAssembler.PROFILE_HEADER))
                .isGreaterThan(prompt.indexOf(factsHeader))
                .isLessThan(prompt.indexOf(PromptMemoryAssembler.MEMORIES_HEADER));
    }
}

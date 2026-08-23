package io.mrkuhne.mezo.feature.companion.profile;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.profile.service.ProfileAssembler;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.FeedbackPopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/** W4.3 (mezo-b3pp.17, spec §8.3): the weekly profile synthesis. */
@ActiveProfiles("companion-fake")
class ProfileAssemblerIT extends AbstractIntegrationTest {

    @Autowired
    private ProfileAssembler assembler;
    @Autowired
    private GraphNodeRepository nodeRepository;
    @Autowired
    private FeedbackPopulator feedbackPopulator;
    @Autowired
    private JournalPopulator journalPopulator;
    @Autowired
    private UserPopulator userPopulator;
    @Autowired
    private FakeCompanionLlm fakeCompanionLlm;

    private UUID seedOwner() {
        return userPopulator.createUser("profile-assembler@test.local").getId();
    }

    private void seedSignal(UUID owner) {
        feedbackPopulator.createVerdict(owner, "chat_message", UUID.randomUUID(), "up", null);
        journalPopulator.createReviewedDecision(
                owner, LocalDate.of(2026, 6, 1), "Heti 3 edzés", 4, "Bevált.");
    }

    @Test
    void writes_the_singleton_profile_node_keyed_by_the_user() {
        UUID owner = seedOwner();
        seedSignal(owner);

        Optional<UUID> nodeId = assembler.rebuild(owner);

        assertThat(nodeId).isPresent();
        GraphNodeEntity node = nodeRepository.findById(nodeId.orElseThrow()).orElseThrow();
        assertThat(node.getKind()).isEqualTo(GraphNodeEntity.KIND_INSIGHT);
        assertThat(node.getSourceKind()).isEqualTo(ProfileAssembler.SOURCE_PROFILE);
        assertThat(node.getSourceId()).isEqualTo(owner);
        assertThat(node.getTitle()).isEqualTo(ProfileAssembler.PROFILE_TITLE);
        assertThat(node.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
        assertThat(node.getSummary()).isNotBlank();
    }

    @Test
    void rerunning_updates_the_same_row_instead_of_adding_a_second_one() {
        UUID owner = seedOwner();
        seedSignal(owner);

        UUID first = assembler.rebuild(owner).orElseThrow();
        UUID second = assembler.rebuild(owner).orElseThrow();

        assertThat(second).isEqualTo(first);
        assertThat(nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_ACTIVE))
                .filteredOn(n -> ProfileAssembler.SOURCE_PROFILE.equals(n.getSourceKind()))
                .hasSize(1);
    }

    @Test
    void an_archived_profile_is_revived_by_the_next_run() {
        UUID owner = seedOwner();
        seedSignal(owner);
        UUID nodeId = assembler.rebuild(owner).orElseThrow();
        GraphNodeEntity archived = nodeRepository.findById(nodeId).orElseThrow();
        archived.setStatus(GraphNodeEntity.STATUS_ARCHIVED);
        nodeRepository.saveAndFlush(archived);

        assembler.rebuild(owner);

        assertThat(nodeRepository.findById(nodeId).orElseThrow().getStatus())
                .isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
    }

    @Test
    void no_signal_means_no_profile_and_no_llm_call() {
        UUID owner = seedOwner();
        long before = fakeCompanionLlm.completeCallCount();

        assertThat(assembler.rebuild(owner)).isEmpty();

        assertThat(fakeCompanionLlm.completeCallCount()).isEqualTo(before);
        assertThat(nodeRepository.findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(
                owner, ProfileAssembler.SOURCE_PROFILE, owner)).isEmpty();
    }

    @Test
    void the_stored_prose_is_capped_at_the_configured_token_budget() {
        UUID owner = seedOwner();
        seedSignal(owner);

        UUID nodeId = assembler.rebuild(owner).orElseThrow();

        assertThat(nodeRepository.findById(nodeId).orElseThrow().getSummary().length())
                .isLessThanOrEqualTo(400 * 3);
    }

    @Test
    void the_fake_llm_mirror_still_matches_the_marker() {
        assertThat(ProfileAssembler.PROFILE_MARKER).isEqualTo("ROLAD-TANULTAM");
    }
}

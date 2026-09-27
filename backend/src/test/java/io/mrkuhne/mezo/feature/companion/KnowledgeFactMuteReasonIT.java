package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.UpdateFactRequest;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** S6 (mezo-d6ivw.6) Task A2: every muted fact says WHY. */
class KnowledgeFactMuteReasonIT extends AbstractIntegrationTest {

    @Autowired private KnowledgeFactService service;
    @Autowired private KnowledgeFactRepository repository;
    @Autowired private KnowledgeFactPopulator factPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void update_shouldMarkUserMute_andReEnableClearsIt() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Reggel edzel", "train", 1);

        service.update(owner, fact.getId(), UpdateFactRequest.builder().includeInPrompt(false).build());
        KnowledgeFactEntity muted = repository.findById(fact.getId()).orElseThrow();
        assertThat(muted.getMutedReason()).isEqualTo(KnowledgeFactEntity.MUTED_USER);
        assertThat(muted.getMutedAt()).isNotNull();

        service.update(owner, fact.getId(), UpdateFactRequest.builder().includeInPrompt(true).build());
        KnowledgeFactEntity back = repository.findById(fact.getId()).orElseThrow();
        assertThat(back.isIncludeInPrompt()).isTrue();
        assertThat(back.getMutedReason()).isNull();
        assertThat(back.getMutedAt()).isNull();
    }

    @Test
    void update_shouldKeepAnExistingReason_whenMutedAgain() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Régi állítás", "life", 0);
        Instant at = Instant.parse("2026-09-21T09:20:00Z");
        fact.mute(KnowledgeFactEntity.MUTED_SUPERSEDED, at);
        repository.saveAndFlush(fact);

        service.update(owner, fact.getId(), UpdateFactRequest.builder().includeInPrompt(false).build());

        KnowledgeFactEntity reread = repository.findById(fact.getId()).orElseThrow();
        assertThat(reread.getMutedReason()).isEqualTo(KnowledgeFactEntity.MUTED_SUPERSEDED);
        assertThat(reread.getMutedAt()).isEqualTo(at);
    }

    @Test
    void update_shouldNotTouchMuteState_whenOnlyTextChanges() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Elütés", "life", 0);

        service.update(owner, fact.getId(), UpdateFactRequest.builder().factText("Javított szöveg").build());

        KnowledgeFactEntity reread = repository.findById(fact.getId()).orElseThrow();
        assertThat(reread.getFactText()).isEqualTo("Javított szöveg");
        assertThat(reread.isIncludeInPrompt()).isTrue();
        assertThat(reread.getMutedReason()).isNull();
    }

    @Test
    void muteFromRefutedPattern_shouldMarkRefuted() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Cáfolt", "health", 0, true,
                KnowledgeFactEntity.SOURCE_PATTERN);

        service.muteFromRefutedPattern(owner, fact.getId());

        KnowledgeFactEntity reread = repository.findById(fact.getId()).orElseThrow();
        assertThat(reread.isIncludeInPrompt()).isFalse();
        assertThat(reread.getMutedReason()).isEqualTo(KnowledgeFactEntity.MUTED_REFUTED);
        assertThat(reread.getMutedAt()).isNotNull();
    }

    /** Final review Important 3: re-enabling a superseded fact must put it back in EVERY prompt
     *  channel — retrieval and the S7 owner read both skip rows with superseded_by set. */
    @Test
    void update_reEnablingASupersededFact_shouldClearSupersededBy() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity successor = factPopulator.fact(owner, "Új állítás", "life", 0);
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Régi állítás", "life", 0);
        fact.mute(KnowledgeFactEntity.MUTED_SUPERSEDED, Instant.now());
        fact.setSupersededBy(successor.getId());
        repository.saveAndFlush(fact);

        service.update(owner, fact.getId(), UpdateFactRequest.builder().includeInPrompt(true).build());

        KnowledgeFactEntity reread = repository.findById(fact.getId()).orElseThrow();
        assertThat(reread.isIncludeInPrompt()).isTrue();
        assertThat(reread.getMutedReason()).isNull();
        assertThat(reread.getSupersededBy()).isNull();
        assertThat(service.promptFactsForOwners(owner, java.util.List.of(reread.getOwner()), 10))
                .contains("Régi állítás");
    }
}

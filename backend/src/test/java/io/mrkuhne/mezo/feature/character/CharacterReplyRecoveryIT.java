package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.repository.CharacterReplyRepository;
import io.mrkuhne.mezo.feature.character.service.CharacterReplyRecoveryJob;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CharacterReplyPopulator;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

@Import(CharacterReplyPopulator.class)
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.techcore.cron.character-reply-job.enabled=true")
class CharacterReplyRecoveryIT extends ApiIntegrationTest {
    @Autowired private CharacterReplyPopulator data;
    @Autowired private OwnerProperties owner;
    @Autowired private CharacterReplyRepository replies;
    @Autowired private CharacterReplyRecoveryJob job;

    @Test
    void testRecovery_shouldProcessDurableUnstartedReply_whenProcessLostEvent() throws Exception {
        var ownerId = databasePopulator.populateUser(owner.ownerEmail());
        var claim = data.claim(ownerId);
        var saved = data.savedReply(ownerId, claim, "Hétvégén.");
        job.run();
        for (int i = 0;
                i < 100
                        && !"COMPLETED"
                                .equals(replies.findById(saved.getId()).orElseThrow().getStatus());
                i++) Thread.sleep(50);
        assertThat(replies.findById(saved.getId()).orElseThrow().getStatus())
                .isEqualTo("COMPLETED");
        assertThat(replies.findAll()).hasSize(1);
    }
}

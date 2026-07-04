package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Test data factory for the Mention aggregate — see
 * docs/references/integration_test_framework.md. Persists via repository
 * {@code saveAndFlush} so DB CHECKs fire.
 */
@TestComponent
@RequiredArgsConstructor
public class MentionPopulator {

    private final MentionRepository mentionRepository;

    public MentionEntity createMention(UUID owner, UUID personId, Instant ts, String tone) {
        MentionEntity m = new MentionEntity();
        m.setCreatedBy(owner);
        m.setPersonId(personId);
        m.setTs(ts);
        m.setSource("chip");
        m.setExcerpt("Teszt említés.");
        m.setTone(tone);
        m.setFlagged(false);
        return mentionRepository.saveAndFlush(m);
    }
}

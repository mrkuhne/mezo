package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.notification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.AppNotificationPopulator;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;

class AppNotificationRepositoryIT extends AbstractIntegrationTest {

    @Autowired private AppNotificationRepository repository;
    @Autowired private AppNotificationPopulator populator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testFindByCreatedBy_shouldReturnNewestFirst_whenMultipleRowsExist() {
        var owner = ownerId();
        populator.notification(owner, "pattern_inbox", "pattern_inbox:a", Instant.parse("2026-08-18T04:40:00Z"));
        populator.notification(owner, "memory_note", "memory_note:b", Instant.parse("2026-08-18T00:20:00Z"));

        var rows = repository.findByCreatedByAndDeletedFalseOrderByOccurredAtDesc(owner, PageRequest.of(0, 50));

        assertThat(rows).hasSize(2);
        assertThat(rows.get(0).getKind()).isEqualTo("pattern_inbox");
    }

    @Test
    void testSave_shouldViolateUniqueIndex_whenSameDedupKeyInsertedTwice() {
        var owner = ownerId();
        populator.notification(owner, "pattern_inbox", "pattern_inbox:dup", Instant.now());

        assertThatThrownBy(() -> populator.notification(owner, "pattern_inbox", "pattern_inbox:dup", Instant.now()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}

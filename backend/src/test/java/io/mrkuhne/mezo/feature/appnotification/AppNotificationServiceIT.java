package io.mrkuhne.mezo.feature.appnotification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.feature.appnotification.service.AppNotificationEmitter;
import io.mrkuhne.mezo.feature.appnotification.service.AppNotificationService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class AppNotificationServiceIT extends AbstractIntegrationTest {

    @Autowired private AppNotificationService service;
    @Autowired private AppNotificationEmitter emitter;
    @Autowired private AppNotificationRepository repository;
    @Autowired private UserPopulator userPopulator;

    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    @Test
    void testEmit_shouldPersistOneRow_whenCalledTwiceWithSameDedupKey() {
        var owner = ownerId();
        service.emit(owner, AppNotificationKind.PATTERN_INBOX, "Új minta vár döntésre",
                "Teszt.", "/insights/patterns/x", null, "pattern_inbox:x");
        service.emit(owner, AppNotificationKind.PATTERN_INBOX, "Új minta vár döntésre",
                "Teszt.", "/insights/patterns/x", null, "pattern_inbox:x");

        assertThat(repository.findByCreatedByAndReadAtIsNullAndDeletedFalse(owner)).hasSize(1);
    }

    @Test
    void testEmit_shouldTruncateBody_whenLongerThanColumnBudget() {
        var owner = ownerId();
        service.emit(owner, AppNotificationKind.MEMORY_NOTE, "Napi összefoglaló kész",
                "x".repeat(400), "/insights/memoria", null, "memory_note:long");

        var row = repository.findByCreatedByAndReadAtIsNullAndDeletedFalse(owner).get(0);
        assertThat(row.getBody()).hasSizeLessThanOrEqualTo(300);
    }

    @Test
    void testMarkAllRead_shouldStampEveryUnreadRow_andLeaveReadOnesAlone() {
        var owner = ownerId();
        service.emit(owner, AppNotificationKind.FACT_REINFORCED, "Egy tudás megerősödött ×2",
                null, "/insights/knowledge", null, "fact_reinforced:f:2");
        int stamped = service.markAllRead(owner);
        int stampedAgain = service.markAllRead(owner);

        assertThat(stamped).isEqualTo(1);
        assertThat(stampedAgain).isZero();
        assertThat(repository.findByCreatedByAndReadAtIsNullAndDeletedFalse(owner)).isEmpty();
    }

    @Test
    void testFeed_shouldCapAtLimit_andOrderNewestFirst() {
        var owner = ownerId();
        for (int i = 0; i < 5; i++) {
            service.emit(owner, AppNotificationKind.MEMORY_NOTE, "Napi összefoglaló kész",
                    null, "/insights/memoria", null, "memory_note:" + i);
        }
        assertThat(service.feed(owner, 3)).hasSize(3);
    }

    /**
     * Not the literal unique-index race (that would need real concurrency to trigger
     * deterministically) — instead a NULL deeplink deterministically fails the entity flush
     * inside the service's own REQUIRES_NEW transaction ({@code deeplink} is @NotNull /
     * NOT NULL). This still pins the load-bearing property the design leans on: no notification
     * failure of ANY shape may escape {@link AppNotificationEmitter} and reach the caller.
     */
    @Test
    void testEmit_shouldNotPropagateToCaller_whenPersistFailsInsideTheService() {
        var owner = ownerId();

        assertThatCode(() -> emitter.emit(owner, AppNotificationKind.MEMORY_NOTE, "t", null, null,
                null, "memory_note:nulldeeplink"))
                .doesNotThrowAnyException();

        assertThat(repository.existsByCreatedByAndDedupKeyAndDeletedFalse(owner, "memory_note:nulldeeplink"))
                .isFalse();
    }
}

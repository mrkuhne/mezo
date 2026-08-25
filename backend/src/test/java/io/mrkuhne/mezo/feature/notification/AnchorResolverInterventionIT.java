package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.notification.domain.AnchorSet;
import io.mrkuhne.mezo.feature.notification.domain.AnchorSet.AnchoredEvent;
import io.mrkuhne.mezo.feature.notification.domain.NotificationCategory;
import io.mrkuhne.mezo.feature.notification.service.AnchorResolver;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The intervention push anchor (W5.2, bd mezo-b3pp.19) — the row's own generation minute,
 * quiet-hours-DEFERRED (mezo.notification.quiet-hours, default 22:00-07:00) rather than dropped,
 * and channel-gated against {@code CompanionProperties.interventions()}: a {@code channel=feed}
 * library entry (or a key retired from the library) yields no push anchor at all, even though the
 * card itself still exists in the feed. Mirrors {@link AnchorResolverIT}'s harness (fresh
 * self-created owner per test, explicit {@code generatedAt} to avoid wall-clock flakiness).
 */
class AnchorResolverInterventionIT extends AbstractIntegrationTest {

    /** A known Wednesday (matches the current-date convention used elsewhere in this suite). */
    private static final LocalDate WEDNESDAY = LocalDate.of(2026, 7, 29);
    private static final LocalDate TUESDAY = WEDNESDAY.minusDays(1);

    @Autowired private AnchorResolver anchorResolver;
    @Autowired private UserPopulator userPopulator;
    @Autowired private CompanionMessagePopulator companionMessagePopulator;

    private static Instant generatedAt(LocalDate date, int hour, int minute) {
        return date.atTime(LocalTime.of(hour, minute)).atZone(ZoneId.systemDefault()).toInstant();
    }

    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    private static AnchoredEvent interventionEvent(AnchorSet anchors) {
        return anchors.backendAnchors().stream()
                .filter(e -> e.category() == NotificationCategory.INTERVENTION)
                .findFirst()
                .orElseThrow(() -> new AssertionError("no intervention anchor was resolved"));
    }

    @Test
    void testResolve_shouldAnchorOnItsOwnGenerationMinute_whenABothChannelCardIsGeneratedInDaytime() {
        UUID owner = ownerId();
        String text = "Több napja magas a stressz-szinted. Ma este tarts egy tudatos lezárást.";
        var card = companionMessagePopulator.createIntervention(owner, WEDNESDAY, "stress_reset", text,
                generatedAt(WEDNESDAY, 14, 37));

        AnchorSet anchors = anchorResolver.resolve(owner, WEDNESDAY);

        AnchoredEvent event = interventionEvent(anchors);
        String idFragment = card.getId().toString().substring(0, 8);
        assertThat(event.minuteOfDay()).isEqualTo(14 * 60 + 37);
        assertThat(event.dedupSuffix()).isEqualTo("14:37:" + idFragment);
        assertThat(event.url()).isEqualTo("/today?n=" + idFragment);
        assertThat(event.body()).isEqualTo(text);
    }

    @Test
    void testResolve_shouldDeferAcrossTheDayBoundary_whenABothChannelCardIsGeneratedInQuietHours() {
        UUID owner = ownerId();
        companionMessagePopulator.createIntervention(owner, TUESDAY, "stress_reset",
                "Több napja magas a stressz-szinted.", generatedAt(TUESDAY, 23, 10));

        AnchorSet yesterdayAnchors = anchorResolver.resolve(owner, TUESDAY);
        AnchorSet todayAnchors = anchorResolver.resolve(owner, WEDNESDAY);

        assertThat(yesterdayAnchors.backendAnchors())
                .as("the quiet-hours card does not anchor on its own generation day")
                .noneMatch(e -> e.category() == NotificationCategory.INTERVENTION);
        assertThat(interventionEvent(todayAnchors).minuteOfDay())
                .as("deferred to the next day's quiet-hours end, 07:00")
                .isEqualTo(7 * 60);
    }

    @Test
    void testResolve_shouldYieldNoAnchor_whenTheCardsLibraryEntryIsFeedOnly() {
        UUID owner = ownerId();
        companionMessagePopulator.createIntervention(owner, WEDNESDAY, "healthy_celebrate",
                "Egy hete minden mutatód rendben.", generatedAt(WEDNESDAY, 14, 37));

        AnchorSet anchors = anchorResolver.resolve(owner, WEDNESDAY);

        assertThat(anchors.backendAnchors())
                .noneMatch(e -> e.category() == NotificationCategory.INTERVENTION);
    }

    @Test
    void testResolve_shouldYieldNoAnchor_whenTheCardsKeyIsNotInTheLibrary() {
        UUID owner = ownerId();
        companionMessagePopulator.createIntervention(owner, WEDNESDAY, "retired_key",
                "Ez egy kivezetett kulcs.", generatedAt(WEDNESDAY, 14, 37));

        AnchorSet anchors = anchorResolver.resolve(owner, WEDNESDAY);

        assertThat(anchors.backendAnchors())
                .noneMatch(e -> e.category() == NotificationCategory.INTERVENTION);
    }
}

package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.notification.domain.AnchorSet;
import io.mrkuhne.mezo.feature.notification.domain.NotificationCategory;
import io.mrkuhne.mezo.feature.notification.service.AnchorResolver;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * With the ritual switch OFF, the whole {@code RitualService} bean is absent (trap #3) — a
 * separate {@code @TestPropertySource} class because that annotation needs its own Spring
 * context, exactly like {@code RitualSwitchOffIT}. {@link AnchorResolver} must inject it via
 * {@code ObjectProvider} and yield NO {@code ritual}/{@code lights_out}/{@code wind_down} anchor
 * in that case — never a fabricated window — while every other category keeps resolving normally.
 */
@TestPropertySource(properties = "mezo.feature.ritual.enabled=false")
class AnchorResolverRitualSwitchOffIT extends AbstractIntegrationTest {

    private static final LocalDate WEDNESDAY = LocalDate.of(2026, 7, 29);

    @Autowired private AnchorResolver anchorResolver;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private TrainPopulator trainPopulator;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testResolve_shouldYieldNoRitualFamilyAnchors_whenRitualSwitchIsOff() {
        UUID owner = ownerId();
        int legacyDayOfWeek = WEDNESDAY.getDayOfWeek().getValue() - 1;
        trainPopulator.createGymSlot(owner, legacyDayOfWeek, "17:30"); // proves non-ritual reads still work

        AnchorSet anchors = anchorResolver.resolve(owner, WEDNESDAY);

        assertThat(anchors.backendAnchors())
                .as("no ritual-family anchor is fabricated when the RitualService bean is absent")
                .noneMatch(e -> e.category() == NotificationCategory.RITUAL)
                .noneMatch(e -> e.category() == NotificationCategory.LIGHTS_OUT)
                .noneMatch(e -> e.category() == NotificationCategory.WIND_DOWN);
        assertThat(anchors.backendAnchors())
                .as("a category that does not depend on RitualService still resolves")
                .anyMatch(e -> e.category() == NotificationCategory.GYM);
    }
}

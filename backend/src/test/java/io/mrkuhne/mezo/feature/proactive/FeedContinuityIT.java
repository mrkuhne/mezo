package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.service.FeedContinuityService;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

@TestPropertySource(properties = "mezo.feature.contextual-feed.enabled=true")
class FeedContinuityIT extends AbstractIntegrationTest {
    private static final LocalDate DAY = LocalDate.of(2026, 9, 23);
    private static final Instant NOW = Instant.parse("2026-09-23T10:00:00Z");
    @Autowired private FeedContinuityService service;
    @Autowired private DatabasePopulator users;
    @Autowired private CompanionMessagePopulator messages;
    @Autowired private CompanionMessageRepository repository;

    @Test
    void testRender_shouldIncludePriorDaysAndExcludeInvisibleRows_whenHistoryExists() {
        UUID user = users.populateUser("feed-history@test.local");
        UUID other = users.populateUser("feed-other@test.local");
        var yesterday = messages.createMessage(user, DAY.minusDays(1), "weight", "Tegnap",
                List.of("Ezt korábban gondoltuk."), NOW.minusSeconds(86400));
        var morning = messages.createMessage(user, DAY, "morning", "Ma",
                List.of("Ma reggel megbeszéltük."), NOW.minusSeconds(3600));
        messages.createMessage(other, DAY, "weight", "Idegen", List.of("PRIVATE"), NOW.minusSeconds(1));
        messages.createMessage(user, DAY, "evening", "Jövő", List.of("FUTURE"), NOW.plusSeconds(1));
        messages.createMessage(user, DAY.minusDays(14), "weight", "Régi", List.of("OLD"), NOW.minusSeconds(14 * 86400));
        var deleted = messages.createMessage(user, DAY.minusDays(2), "weight", "Törölt",
                List.of("DELETED"), NOW.minusSeconds(2 * 86400));
        repository.delete(deleted);
        repository.flush();
        var result = service.render(user, DAY, NOW, "weight");
        assertThat(result.priorMessageIds()).containsExactly(yesterday.getId(), morning.getId());
        assertThat(result.text()).contains("2026-09-22", "Ezt korábban", yesterday.getId().toString())
                .doesNotContain("PRIVATE", "FUTURE", "DELETED", "OLD");
    }

    @Test
    void testRender_shouldReserveSameKindAndBoundText_whenHistoryIsCrowded() {
        UUID user = users.populateUser("feed-crowded@test.local");
        for (int day = 1; day <= 10; day++) {
            messages.createMessage(user, DAY.minusDays(day), "weight", "Mérés",
                    List.of("w".repeat(1000)), NOW.minusSeconds(day * 86400L));
            messages.createMessage(user, DAY.minusDays(day), "morning", "Reggel",
                    List.of("m".repeat(1000)), NOW.minusSeconds(day * 86400L - 100));
        }
        var result = service.render(user, DAY, NOW, "weight");
        assertThat(result.priorMessageIds()).doesNotHaveDuplicates().hasSizeLessThanOrEqualTo(12);
        assertThat(result.text()).hasSizeLessThanOrEqualTo(8000).contains("levágva");
        assertThat(result.text().split("kind=weight", -1).length - 1).isGreaterThanOrEqualTo(6);
    }

    @Test
    void testRender_shouldBeEmpty_whenNoHistoryExists() {
        var result = service.render(users.populateUser("feed-empty@test.local"), DAY, NOW, "sleep");
        assertThat(result.text()).isEmpty();
        assertThat(result.priorMessageIds()).isEmpty();
    }
}

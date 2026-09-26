package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.feedback.config.FeedbackLearningProperties;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupEntity;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupStatsEnvelope;
import io.mrkuhne.mezo.feature.companion.feedback.repository.FeedbackRollupRepository;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagLogRepository;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Task 4 (bd mezo-a9bo7.21): {@link InterventionService#pick} — the proactive selection seam
 * extracted out of {@code deliverForFlag} — plain unit test, no Spring context. Behaviour must be
 * identical to what {@code InterventionServiceIT} already pins for {@code deliverForFlag} itself;
 * these tests exercise the seam directly with a caller-supplied {@code usedSince} predicate rather
 * than through a real {@code companion_message} row, which {@code deliverForFlag}'s own ITs still
 * cover unmodified.
 */
class InterventionServiceTest {

    private static final String FLAG_KEY = "sustained_stress";

    private final CompanionProperties companionProperties = mock(CompanionProperties.class);
    private final FeedbackLearningProperties feedbackLearningProperties = mock(FeedbackLearningProperties.class);
    private final FeedbackRollupRepository feedbackRollupRepository = mock(FeedbackRollupRepository.class);
    private final CompanionMessageRepository companionMessageRepository = mock(CompanionMessageRepository.class);
    private final CompanionFlagLogRepository companionFlagLogRepository = mock(CompanionFlagLogRepository.class);
    private final AdviceCardService adviceCardService = mock(AdviceCardService.class);

    private InterventionService interventionService;

    @BeforeEach
    void setUp() {
        interventionService = new InterventionService(companionProperties, feedbackLearningProperties,
            feedbackRollupRepository, companionMessageRepository, companionFlagLogRepository, adviceCardService);
        when(feedbackLearningProperties.windowDays()).thenReturn(30);
        when(companionFlagLogRepository
            .findFirstByCreatedByAndFlagKeyAndDeletedFalseOrderByCreatedAtDesc(any(), any()))
            .thenReturn(Optional.empty());
    }

    private CompanionProperties.Intervention entry(String key, int cooldownHours) {
        return new CompanionProperties.Intervention(key, FLAG_KEY, "feed", "Szöveg", cooldownHours, false);
    }

    private void seedRollup(UUID owner, String key, int up, int total) {
        FeedbackRollupEntity rollup = new FeedbackRollupEntity();
        rollup.setStats(FeedbackRollupStatsEnvelope.effectiveness(up, total - up));
        when(feedbackRollupRepository.findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(
            owner, FeedbackRollupEntity.SCOPE_INTERVENTION_PREFIX + key, 30))
            .thenReturn(Optional.of(rollup));
    }

    @Test
    void testPick_shouldReturnTheHighestEffectivenessEntry() {
        UUID owner = UUID.randomUUID();
        when(companionProperties.interventions()).thenReturn(
            List.of(entry("stress_reset", 48), entry("stress_talk", 72)));
        seedRollup(owner, "stress_reset", 1, 4);
        seedRollup(owner, "stress_talk", 3, 4);

        Optional<AdvicePick> result = interventionService.pick(owner, FLAG_KEY, (key, since) -> false);

        assertThat(result).isPresent();
        assertThat(result.get().entryKey()).isEqualTo("stress_talk");
        assertThat(result.get().flagKey()).isEqualTo(FLAG_KEY);
        assertThat(result.get().textHu()).isEqualTo("Szöveg");
    }

    @Test
    void testPick_shouldHonourThePredicate_whenTheBestKeyIsAlreadyUsed() {
        UUID owner = UUID.randomUUID();
        when(companionProperties.interventions()).thenReturn(
            List.of(entry("stress_reset", 48), entry("stress_talk", 72)));
        seedRollup(owner, "stress_reset", 1, 4);
        seedRollup(owner, "stress_talk", 3, 4);

        Optional<AdvicePick> result = interventionService.pick(owner, FLAG_KEY,
            (key, since) -> "stress_talk".equals(key));

        assertThat(result).isPresent();
        assertThat(result.get().entryKey()).isEqualTo("stress_reset");
    }

    @Test
    void testPick_shouldReturnEmpty_whenEveryCandidateIsUsed() {
        UUID owner = UUID.randomUUID();
        when(companionProperties.interventions()).thenReturn(
            List.of(entry("stress_reset", 48), entry("stress_talk", 72)));

        Optional<AdvicePick> result = interventionService.pick(owner, FLAG_KEY, (key, since) -> true);

        assertThat(result).isEmpty();
    }

    @Test
    void testPick_shouldReturnEmpty_whenNoLibraryEntryMatchesTheFlag() {
        UUID owner = UUID.randomUUID();
        when(companionProperties.interventions()).thenReturn(
            List.of(new CompanionProperties.Intervention("other_entry", "sleep_debt", "feed", "Szöveg", 48, false)));

        Optional<AdvicePick> result = interventionService.pick(owner, FLAG_KEY, (key, since) -> false);

        assertThat(result).isEmpty();
    }

    @Test
    void testPick_shouldPassThePerEntryCooldownWindowToThePredicate() {
        UUID owner = UUID.randomUUID();
        when(companionProperties.interventions()).thenReturn(List.of(entry("stress_reset", 48)));
        Instant before = Instant.now();

        interventionService.pick(owner, FLAG_KEY, (key, since) -> {
            assertThat(key).isEqualTo("stress_reset");
            // since == now - 48h, computed inside pick — must land strictly before "now - 47h".
            assertThat(since).isBefore(before.minusSeconds(47L * 3600));
            return false;
        });
    }
}

package io.mrkuhne.mezo.feature.proactive;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.LogSleepRequest;
import io.mrkuhne.mezo.api.dto.LogWeightRequest;
import io.mrkuhne.mezo.api.dto.SleepLogResponse;
import io.mrkuhne.mezo.api.dto.WeightLogResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * Event-driven companion-feed triggers (mezo-gst9, task 9): POST a sleep/weight log ->
 * AFTER_COMMIT {@code SleepLogSavedEvent}/{@code WeightLogSavedEvent} -> async {@code
 * CompanionMessageEventListener} -> {@code CompanionMessageGenerator} reaction row. The
 * {@code [fake-feed-sleep:…]}/{@code [fake-feed-weight:…]} sentinels (planted via a check-in note
 * for TODAY — the listener always regenerates against {@code LocalDate.now()}, never the logged
 * date) script the fake LLM's answer; ApiIntegrationTest commits server-side so AFTER_COMMIT
 * genuinely fires, and Awaitility rides out the async hop. Backfill dates never reach the LLM at
 * all (the listener's own freshness guard short-circuits first) — those cases only need a short
 * grace period before asserting absence.
 */
@ActiveProfiles("companion-fake")
class CompanionMessageEventIT extends ApiIntegrationTest {

    @Autowired private CompanionMessageRepository companionMessageRepository;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testLogSleep_shouldCreateSleepReactionMessage_whenDateIsFresh() {
        checkInPopulator.createCheckIn(ownerId(), LocalDate.now(), "06:30", 4, 2,
                "[fake-feed-sleep:{\"eyebrow\":\"Jó alvás\",\"body\":[\"Pihenten kelsz.\"],\"refIndexes\":[]}]");

        postForBody("/api/biometrics/sleep",
                LogSleepRequest.builder()
                        .date(LocalDate.now())
                        .durationH(new BigDecimal("7.50"))
                        .quality(4)
                        .build(),
                ownerAuthHeaders(), HttpStatus.CREATED, SleepLogResponse.class);

        await().atMost(5, SECONDS).untilAsserted(() -> assertThat(companionMessageRepository
                .findByCreatedByAndMessageDateAndKind(
                        ownerId(), LocalDate.now(), CompanionMessageEntity.KIND_SLEEP))
                .hasValueSatisfying(m -> {
                    assertThat(m.getContent().eyebrow()).isEqualTo("Jó alvás");
                    assertThat(m.getContent().body()).containsExactly("Pihenten kelsz.");
                }));
    }

    @Test
    void testLogSleep_shouldNotCreateMessage_whenBackfillDate() throws InterruptedException {
        checkInPopulator.createCheckIn(ownerId(), LocalDate.now(), "06:30", 4, 2,
                "[fake-feed-sleep:{\"eyebrow\":\"Jó alvás\",\"body\":[\"Pihenten kelsz.\"],\"refIndexes\":[]}]");

        postForBody("/api/biometrics/sleep",
                LogSleepRequest.builder()
                        .date(LocalDate.now().minusDays(5))
                        .durationH(new BigDecimal("7.50"))
                        .quality(4)
                        .build(),
                ownerAuthHeaders(), HttpStatus.CREATED, SleepLogResponse.class);

        Thread.sleep(1000); // grace period for the async listener to (not) fire
        assertThat(companionMessageRepository.findByCreatedByAndMessageDateAndKind(
                ownerId(), LocalDate.now(), CompanionMessageEntity.KIND_SLEEP)).isEmpty();
    }

    @Test
    void testLogWeight_shouldCreateWeightReactionMessage_whenToday() {
        checkInPopulator.createCheckIn(ownerId(), LocalDate.now(), "06:30", 4, 2,
                "[fake-feed-weight:{\"eyebrow\":\"Mérés kész\",\"body\":[\"Stabil úton vagy.\"],\"refIndexes\":[]}]");

        postForBody("/api/biometrics/weight",
                LogWeightRequest.builder()
                        .date(LocalDate.now())
                        .weightKg(new BigDecimal("82.40"))
                        .build(),
                ownerAuthHeaders(), HttpStatus.CREATED, WeightLogResponse.class);

        await().atMost(5, SECONDS).untilAsserted(() -> assertThat(companionMessageRepository
                .findByCreatedByAndMessageDateAndKind(
                        ownerId(), LocalDate.now(), CompanionMessageEntity.KIND_WEIGHT))
                .hasValueSatisfying(m -> {
                    assertThat(m.getContent().eyebrow()).isEqualTo("Mérés kész");
                    assertThat(m.getContent().body()).containsExactly("Stabil úton vagy.");
                }));
    }

    @Test
    void testLogWeight_shouldNotCreateMessage_whenBackfillDate() throws InterruptedException {
        checkInPopulator.createCheckIn(ownerId(), LocalDate.now(), "06:30", 4, 2,
                "[fake-feed-weight:{\"eyebrow\":\"Mérés kész\",\"body\":[\"Stabil úton vagy.\"],\"refIndexes\":[]}]");

        postForBody("/api/biometrics/weight",
                LogWeightRequest.builder()
                        .date(LocalDate.now().minusDays(1))
                        .weightKg(new BigDecimal("82.40"))
                        .build(),
                ownerAuthHeaders(), HttpStatus.CREATED, WeightLogResponse.class);

        Thread.sleep(1000); // grace period for the async listener to (not) fire
        assertThat(companionMessageRepository.findByCreatedByAndMessageDateAndKind(
                ownerId(), LocalDate.now(), CompanionMessageEntity.KIND_WEIGHT)).isEmpty();
    }
}

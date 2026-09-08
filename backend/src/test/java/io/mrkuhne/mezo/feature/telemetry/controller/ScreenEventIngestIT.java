package io.mrkuhne.mezo.feature.telemetry.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ScreenEventBatchRequest;
import io.mrkuhne.mezo.api.dto.ScreenEventInput;
import io.mrkuhne.mezo.feature.telemetry.entity.ScreenEventEntity;
import io.mrkuhne.mezo.feature.telemetry.repository.ScreenEventRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * POST /api/telemetry/screen-events (bd mezo-o5cz, spec §7).
 *
 * <p>Every test uses its OWN freshly registered account, never the shared demodata owner: the
 * rate limiter's token bucket is in-memory and keyed by user, so two tests sharing a principal
 * would share a budget and their order would decide the outcome.
 */
class ScreenEventIngestIT extends ApiIntegrationTest {

    private static final String URI = "/api/telemetry/screen-events";

    @Autowired private ScreenEventRepository repository;

    private static ScreenEventInput event(String screen, OffsetDateTime at) {
        return ScreenEventInput.builder().screen(screen).occurredAt(at).build();
    }

    private static ScreenEventBatchRequest batch(List<ScreenEventInput> events) {
        return ScreenEventBatchRequest.builder().events(events).build();
    }

    @Test
    void testIngest_shouldStoreOneRowPerEventOwnedByTheCaller_whenBatchAccepted() {
        RegisteredUser anna = registerUser("Anna");
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        postForBody(URI, batch(List.of(event("/nap", now), event("/admin/users/:id", now))),
                anna.headers(), HttpStatus.ACCEPTED, Void.class);

        List<ScreenEventEntity> rows = repository.findAll();
        assertThat(rows).hasSize(2);
        assertThat(rows).allSatisfy(row -> {
            // The owner comes from the JWT, never the payload (spec T5) — the request body has
            // no owner field at all, so a regression here could only be a stamping bug.
            assertThat(row.getCreatedBy()).isEqualTo(anna.id());
            assertThat(row.getEvent()).isEqualTo(ScreenEventEntity.EVENT_VIEW);
        });
        assertThat(rows).extracting(ScreenEventEntity::getScreen)
                .containsExactlyInAnyOrder("/nap", "/admin/users/:id");
    }

    @Test
    void testIngest_shouldReturn400_whenBatchExceedsTheConfiguredCap() {
        RegisteredUser anna = registerUser("Anna");
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        // batch-max is 50 (application.yml); 51 is over the cap and must be REJECTED, not
        // silently truncated — a client whose buffer outgrew the cap has to learn about it.
        List<ScreenEventInput> tooMany = IntStream.range(0, 51).mapToObj(i -> event("/nap", now)).toList();

        assertHasRequestError(postForBody(URI, batch(tooMany), anna.headers(), HttpStatus.BAD_REQUEST, String.class),
                "TELEMETRY_BATCH_TOO_LARGE");
        assertThat(repository.count()).isZero();
    }

    @Test
    void testIngest_shouldReturn429_whenThePerUserMinuteBudgetIsExhausted() {
        RegisteredUser anna = registerUser("Anna");
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        List<ScreenEventInput> fifty = IntStream.range(0, 50).mapToObj(i -> event("/nap", now)).toList();

        // rate-limit-per-minute is 120: the first two full batches fit (100), the third does not.
        postForBody(URI, batch(fifty), anna.headers(), HttpStatus.ACCEPTED, Void.class);
        postForBody(URI, batch(fifty), anna.headers(), HttpStatus.ACCEPTED, Void.class);
        assertHasRequestError(postForBody(URI, batch(fifty), anna.headers(), HttpStatus.TOO_MANY_REQUESTS, String.class),
                "TELEMETRY_RATE_LIMITED");

        assertThat(repository.count()).isEqualTo(100);
    }

    @Test
    void testIngest_shouldClampOccurredAtIntoTheAllowedWindow_whenTheClientClockIsWrong() {
        RegisteredUser anna = registerUser("Anna");
        Instant before = Instant.now();
        OffsetDateTime tenDaysAhead = OffsetDateTime.now(ZoneOffset.UTC).plusDays(10);
        OffsetDateTime lastYear = OffsetDateTime.now(ZoneOffset.UTC).minusDays(365);

        postForBody(URI, batch(List.of(event("/future", tenDaysAhead), event("/past", lastYear))),
                anna.headers(), HttpStatus.ACCEPTED, Void.class);

        // occurred-at-clamp-hours is 24, so both land on the window edge, not where the client said.
        Instant after = Instant.now();
        var byScreen = repository.findAll().stream()
                .collect(java.util.stream.Collectors.toMap(ScreenEventEntity::getScreen, e -> e));
        assertThat(byScreen.get("/future").getOccurredAt())
                .isBetween(before.plus(Duration.ofHours(24)), after.plus(Duration.ofHours(24)));
        assertThat(byScreen.get("/past").getOccurredAt())
                .isBetween(before.minus(Duration.ofHours(24)), after.minus(Duration.ofHours(24)));
    }
}

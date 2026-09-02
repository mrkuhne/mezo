package io.mrkuhne.mezo.feature.tutorial;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SetTutorialProgressRequest;
import io.mrkuhne.mezo.api.dto.TutorialProgressEntry;
import io.mrkuhne.mezo.api.dto.TutorialProgressResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

/** HTTP round-trips through the generated {@code TutorialProgressApi} contract (mezo-gb1s.1). */
class TutorialProgressApiIT extends ApiIntegrationTest {

    private static final OffsetDateTime T0 = OffsetDateTime.of(2026, 9, 2, 12, 0, 0, 0, ZoneOffset.UTC);

    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private JdbcTemplate jdbcTemplate;

    private static TutorialProgressEntry seen(int version) {
        return TutorialProgressEntry.builder().version(version).seenAt(T0).build();
    }

    @Test
    void testGetTutorialProgress_shouldReturnEmptyGhost_whenNothingSeen() {
        TutorialProgressResponse r =
            getForBody("/api/tutorial/progress", ownerAuthHeaders(), HttpStatus.OK, TutorialProgressResponse.class);

        assertThat(r.getProgress()).isEmpty();
    }

    @Test
    void testSetTutorialProgress_shouldReplaceWholeMap_whenSavedTwice() {
        HttpHeaders auth = ownerAuthHeaders();
        putForBody("/api/tutorial/progress",
            SetTutorialProgressRequest.builder().progress(Map.of("fuel", seen(1), "welcome", seen(1))).build(),
            auth, HttpStatus.OK, TutorialProgressResponse.class);
        TutorialProgressResponse second = putForBody("/api/tutorial/progress",
            SetTutorialProgressRequest.builder().progress(Map.of("fuel",
                TutorialProgressEntry.builder().version(2).seenAt(T0).completedAt(T0.plusMinutes(1)).build())).build(),
            auth, HttpStatus.OK, TutorialProgressResponse.class);

        // PUT = teljes csere: a welcome kulcs eltűnt, a fuel a 2-es verzióval, completedAt-tal jött vissza
        assertThat(second.getProgress()).containsOnlyKeys("fuel");
        assertThat(second.getProgress().get("fuel").getVersion()).isEqualTo(2);
        assertThat(second.getProgress().get("fuel").getCompletedAt()).isEqualTo(T0.plusMinutes(1));

        TutorialProgressResponse read =
            getForBody("/api/tutorial/progress", auth, HttpStatus.OK, TutorialProgressResponse.class);
        assertThat(read.getProgress()).containsOnlyKeys("fuel");
        assertThat(read.getProgress().get("fuel").getSeenAt()).isEqualTo(T0);
        assertThat(read.getProgress().get("fuel").getDismissedAtStep()).isNull();
    }

    @Test
    void testResetTutorialProgress_shouldReturnEmptyGhost_afterDelete() {
        HttpHeaders auth = ownerAuthHeaders();
        putForBody("/api/tutorial/progress",
            SetTutorialProgressRequest.builder().progress(Map.of("fuel", seen(1))).build(),
            auth, HttpStatus.OK, TutorialProgressResponse.class);

        exchangeForBody(HttpMethod.DELETE, "/api/tutorial/progress", null, auth, HttpStatus.NO_CONTENT, Void.class);

        TutorialProgressResponse read =
            getForBody("/api/tutorial/progress", auth, HttpStatus.OK, TutorialProgressResponse.class);
        assertThat(read.getProgress()).isEmpty();

        // reset után az újra-mentés új élő sort hoz (a partial-unique index a soft-deleted sort nem számolja)
        TutorialProgressResponse again = putForBody("/api/tutorial/progress",
            SetTutorialProgressRequest.builder().progress(Map.of("fuel", seen(3))).build(),
            auth, HttpStatus.OK, TutorialProgressResponse.class);
        assertThat(again.getProgress().get("fuel").getVersion()).isEqualTo(3);
    }

    @Test
    void testSetTutorialProgress_shouldReturn400_whenEntryInvalid() {
        SetTutorialProgressRequest bad = SetTutorialProgressRequest.builder()
            .progress(Map.of("fuel", TutorialProgressEntry.builder().version(0).seenAt(T0).build()))
            .build();

        putForBody("/api/tutorial/progress", bad, ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void testTutorialProgressEndpoints_shouldReturn401_whenNoToken() {
        getForBody("/api/tutorial/progress", null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testSetTutorialProgress_shouldReturnEmptyMap_whenProgressIsEmpty() {
        TutorialProgressResponse r = putForBody("/api/tutorial/progress",
            SetTutorialProgressRequest.builder().progress(Map.of()).build(),
            ownerAuthHeaders(), HttpStatus.OK, TutorialProgressResponse.class);

        assertThat(r.getProgress()).isEmpty();
    }

    @Test
    void testGetTutorialProgress_shouldSkipCorruptEntry_whenSeenAtIsNotParseable() {
        HttpHeaders auth = ownerAuthHeaders();
        // Create the live row through the real API first (server-side createdBy, etc.).
        putForBody("/api/tutorial/progress",
            SetTutorialProgressRequest.builder().progress(Map.of("fuel", seen(1), "nap", seen(1))).build(),
            auth, HttpStatus.OK, TutorialProgressResponse.class);

        // A manual DB edit / future writer bug: "fuel" gets a non-ISO seenAt directly in the jsonb.
        java.util.UUID ownerId = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
        jdbcTemplate.update(
            "update tutorial_progress set progress = "
                + "'{\"fuel\":{\"version\":1,\"seenAt\":\"nem-datum\"},"
                + "\"nap\":{\"version\":1,\"seenAt\":\"2026-09-02T12:00:00Z\"}}'::jsonb "
                + "where created_by = ? and is_deleted = false",
            ownerId);

        TutorialProgressResponse read =
            getForBody("/api/tutorial/progress", auth, HttpStatus.OK, TutorialProgressResponse.class);

        assertThat(read.getProgress()).containsOnlyKeys("nap");
    }
}

package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("companion-fake")
class CompanionPreferencesApiIT extends ApiIntegrationTest {
    @Test
    void testPreferences_shouldPersistClearAndIsolate_whenUpdated() {
        var a = registerUser("pref-a").headers();
        var b = registerUser("pref-b").headers();
        String path = "/api/companion/preferences";
        assertThat(getForBody(path, a, HttpStatus.OK, Map.class))
                .containsEntry("aboutMe", "").containsEntry("useLearnedProfile", true);
        var body = Map.of("aboutMe", "Szoftverfejlesztő vagyok.",
                "customInstructions", "Légy tömör.", "useLearnedProfile", false);
        putForBody(path, body, a, HttpStatus.OK, Map.class);
        assertThat(getForBody(path, a, HttpStatus.OK, Map.class)).containsAllEntriesOf(body);
        assertThat(getForBody(path, b, HttpStatus.OK, Map.class)).containsEntry("aboutMe", "");
        assertThat(getForBody("/api/companion/personal-context", a, HttpStatus.OK, Map.class).get("renderedText").toString())
                .contains("Szoftverfejlesztő vagyok.", "Légy tömör.");
        assertThat(getForBody("/api/companion/personal-context", b, HttpStatus.OK, Map.class).get("renderedText").toString())
                .doesNotContain("Szoftverfejlesztő vagyok.", "Légy tömör.");
        putForBody(path, Map.of("aboutMe", "", "customInstructions", "", "useLearnedProfile", true),
                a, HttpStatus.OK, Map.class);
        assertThat(getForBody(path, a, HttpStatus.OK, Map.class)).containsEntry("customInstructions", "");
    }

    @Test
    void testPreferences_shouldRejectOversizedAndMissingText_whenInvalid() {
        var headers = ownerAuthHeaders();
        putForBody("/api/companion/preferences", Map.of("aboutMe", "", "customInstructions", ""),
                headers, HttpStatus.BAD_REQUEST, String.class);
        putForBody("/api/companion/preferences", Map.of("aboutMe", "x".repeat(4001), "customInstructions", "", "useLearnedProfile", true),
                headers, HttpStatus.BAD_REQUEST, String.class);
        putForBody("/api/companion/preferences", Map.of("aboutMe", "", "useLearnedProfile", true),
                headers, HttpStatus.BAD_REQUEST, String.class);
        putForBody("/api/companion/preferences", Map.of("aboutMe", "", "customInstructions", "x".repeat(4001), "useLearnedProfile", true),
                headers, HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void testEndpoints_shouldRequireAuthentication_whenAnonymous() {
        getForBody("/api/companion/preferences", null, HttpStatus.UNAUTHORIZED, String.class);
        getForBody("/api/companion/personal-context", null, HttpStatus.UNAUTHORIZED, String.class);
        putForBody("/api/companion/preferences", Map.of("aboutMe", "", "customInstructions", "", "useLearnedProfile", true),
                null, HttpStatus.UNAUTHORIZED, String.class);
    }
}

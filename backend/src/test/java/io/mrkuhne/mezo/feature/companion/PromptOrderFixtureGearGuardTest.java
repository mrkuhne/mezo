package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.TurnGear;
import io.mrkuhne.mezo.feature.companion.service.TurnGearAnalyzer;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/**
 * Prompt-order ITs assert the FULL volatile context. A fixture message that classifies as CHAT
 * would take the lightened branch and make those assertions vacuous, so every quoted fixture
 * message in those files must be a data-bearing one.
 */
class PromptOrderFixtureGearGuardTest {

    private static final List<String> GUARDED_FILES = List.of(
        "ChatServiceIT.java",
        "ChatServiceAmbientRecallIT.java",
        "ChatMemoryRolloutIT.java",
        "CompanionLlmFakeIT.java",
        "graph/ChatServiceGraphBlockIT.java",
        "graph/ChatServiceGraphBlockFailureIT.java",
        "service/AnchoredConversationIT.java",
        "ChatStreamServiceIT.java");

    /**
     * How these files spell a fixture message. `ChatServiceIT` uses a local helper —
     * `request("szia")` over `SendMessageRequest.builder().content(content).build()` — so matching
     * only `setContent(..)` would find NOTHING and the guard would pass while testing nothing.
     */
    private static final Pattern FIXTURE_MESSAGE =
        Pattern.compile("(?:request|setContent|content)\\(\"([^\"]+)\"\\)");

    private final TurnGearAnalyzer analyzer = new TurnGearAnalyzer();

    @Test
    void testFixtureMessages_shouldNeverClassifyAsChat_whenTheyAssertPromptOrder() throws IOException {
        Path base = Path.of("src/test/java/io/mrkuhne/mezo/feature/companion");
        List<String> offenders = new ArrayList<>();
        for (String file : GUARDED_FILES) {
            Path path = base.resolve(file);
            if (!Files.exists(path)) {
                continue;
            }
            String source = Files.readString(path, StandardCharsets.UTF_8);
            Matcher matcher = FIXTURE_MESSAGE.matcher(source);
            while (matcher.find()) {
                String message = matcher.group(1);
                if (analyzer.analyze(message).filter(TurnGear.CHAT::equals).isPresent()) {
                    offenders.add(file + " -> \"" + message + "\"");
                }
            }
        }
        assertThat(offenders)
            .as("these fixture messages would take the lightened CHAT branch and make the "
                + "prompt-order assertions vacuous; give them a domain or time word")
            .isEmpty();
    }
}

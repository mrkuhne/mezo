package io.mrkuhne.mezo.feature.companion.eval;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/**
 * Drift guard for {@link ToolDomains} (mezo-ozri.3). The domain map decides what counts as a
 * "critical wrong tool", so a tool added to the companion without a domain would silently make
 * every eval run report a phantom critical miss — or, worse, make a legitimate selection look
 * wrong. This reads the {@code @Tool} names straight out of the sources and demands both
 * directions of coverage.
 */
class ToolDomainsTest {

    private static final Path TOOLS_DIR =
        Path.of("src/main/java/io/mrkuhne/mezo/feature/companion/tools");
    private static final Pattern TOOL_NAME = Pattern.compile("@Tool\\(name = \"([a-z_]+)\"");

    @Test
    void testKnownTools_shouldCoverEveryLiveCompanionTool_whenTheSourcesAreScanned() throws IOException {
        Set<String> declared = declaredToolNames();

        assertThat(declared).as("no @Tool names found — did the tools package move?").isNotEmpty();
        assertThat(ToolDomains.knownTools())
            .as("ToolDomains must map every live @Tool name (mezo-ozri.3)")
            .containsExactlyInAnyOrderElementsOf(declared);
    }

    private static Set<String> declaredToolNames() throws IOException {
        Set<String> names = new HashSet<>();
        try (Stream<Path> files = Files.walk(TOOLS_DIR)) {
            for (Path file : files.filter(p -> p.toString().endsWith(".java")).toList()) {
                Matcher matcher = TOOL_NAME.matcher(Files.readString(file));
                while (matcher.find()) {
                    names.add(matcher.group(1));
                }
            }
        }
        return names;
    }
}

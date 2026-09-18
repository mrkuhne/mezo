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
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/**
 * A turn whose message classifies as {@code CHAT} takes the lightened, tool-free branch: no
 * retrieval, no snapshot, no facts, no memories, no graph, no tools, and no LLM verdict (only the
 * deterministic clinical check survives). A test that asserts any of those things while sending a
 * CHAT fixture does not fail — it passes while covering nothing. That is the failure mode this
 * guard exists to make impossible.
 *
 * <p><b>Structural, not a hand-kept list (mezo-rj214.7).</b> The first cut of this guard named
 * eight files explicitly, and six further files with CHAT fixtures were simply never on the list —
 * they broke the day the gear went live. So the scan now starts from EVERY test source under
 * {@code feature/companion} that sends a companion turn at all (it mentions {@code sendMessage},
 * {@code streamMessage}, {@code prepareTurn} or builds a {@code SendMessageRequest}) and audits
 * every fixture call site it finds in them.
 *
 * <p>A call site passes in one of two ways:
 * <ol>
 *   <li>it carries an INLINE string literal that does not classify as {@code CHAT}; or</li>
 *   <li>it carries an adjacent audit marker — {@code // gear-audited: <reason>} on the same line,
 *       or anywhere in the five lines above it (room for the comment block that explains the
 *       decision, and for a call that sits a few lines into a wrapped statement).</li>
 * </ol>
 *
 * <p>Everything else is reported. That includes the forms the old regex silently skipped and which
 * therefore rotted unnoticed: a constant reference ({@code request(QUERY)}) and a helper that
 * forwards someone else's string ({@code .content(content)}). Those are not necessarily wrong —
 * they are simply unauditable from here, so they must say out loud which gear they mean to
 * exercise. A CONCATENATION is judged on its string-literal halves instead, which is sound: the
 * analyzer only ever adds signals, so whatever the runtime half contributes cannot turn a non-CHAT
 * prefix back into CHAT.
 */
class PromptOrderFixtureGearGuardTest {

    /** Where the companion's tests live, relative to the backend module root. */
    private static final Path TEST_ROOT = Path.of("src/test/java/io/mrkuhne/mezo/feature/companion");

    /** A file is in scope when it sends a companion turn in any of these spellings. */
    private static final Pattern SENDS_A_TURN =
        Pattern.compile("sendMessage|streamMessage|prepareTurn|SendMessageRequest");

    /**
     * How these files spell the message argument. {@code ChatServiceIT} uses a local helper —
     * {@code request("szia")} over {@code SendMessageRequest.builder().content(content).build()} —
     * so matching only {@code setContent(..)} would find NOTHING and the guard would pass while
     * testing nothing. Group 1 is the whole argument text, literal or not.
     */
    private static final Pattern FIXTURE_CALL = Pattern.compile(
        "(?:\\brequest|\\bsetContent|\\.content)\\(((?:[^()\"]|\"(?:[^\"\\\\]|\\\\.)*\")*)\\)");

    /** One Java string literal inside that argument, escapes included. */
    private static final Pattern STRING_LITERAL = Pattern.compile("\"((?:[^\"\\\\]|\\\\.)*)\"");

    /**
     * A typed parameter, i.e. {@code request(String content)} — the DECLARATION of a fixture
     * helper, not a call to one. Its callers are the sites worth auditing.
     */
    private static final Pattern PARAMETER_DECLARATION =
        Pattern.compile("^\\s*(?:final\\s+)?[A-Z][\\w.<>,\\[\\]]*\\s+[a-z]\\w*\\s*$");

    /** The escape hatch. Must name a reason, so the next reader knows what was decided and why. */
    private static final Pattern AUDIT_MARKER = Pattern.compile("//\\s*gear-audited:\\s*\\S+");

    /** How many lines above a call site the audit marker may sit. */
    private static final int MARKER_WINDOW = 5;

    /** This file quotes the trigger words in its own javadoc; it sends nothing. */
    private static final String SELF = "PromptOrderFixtureGearGuardTest.java";

    private final TurnGearAnalyzer analyzer = new TurnGearAnalyzer();

    @Test
    void testFixtureMessages_shouldNeverClassifyAsChat_whenTheTestSendsACompanionTurn()
            throws IOException {
        List<String> offenders = new ArrayList<>();
        List<Path> scanned = scannedFiles();

        for (Path path : scanned) {
            String relative = TEST_ROOT.relativize(path).toString();
            List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
            String source = String.join("\n", lines);
            // Conversation-first has no gear gate: these explicitly opted-in fixtures MUST
            // include pronoun-only/general turns to prove tools stay reachable. The global
            // test profile keeps all other fixtures on the rollback path guarded below.
            if (source.contains("\"mezo.companion.conversation.enabled=true\"")) {
                continue;
            }

            Matcher matcher = FIXTURE_CALL.matcher(source);
            while (matcher.find()) {
                String argument = matcher.group(1);
                int line = lineOf(source, matcher.start());
                if (PARAMETER_DECLARATION.matcher(argument).matches() || isAudited(lines, line)) {
                    continue;
                }
                String literals = literalTextOf(argument);
                if (literals == null) {
                    offenders.add(relative + ":" + (line + 1)
                        + " -> unauditable fixture call site: `" + argument.trim() + "`");
                } else if (analyzer.analyze(literals).filter(TurnGear.CHAT::equals).isPresent()) {
                    offenders.add(relative + ":" + (line + 1)
                        + " -> CHAT fixture: \"" + literals.trim() + "\"");
                }
            }
        }

        assertThat(scanned)
            .as("the scan found no companion turn-sending test at all — the guard would be vacuous")
            .hasSizeGreaterThan(10);
        assertThat(offenders)
            .as("""
                A CHAT fixture takes the lightened, tool-free branch, so any assertion about the \
                snapshot, the facts, the memories, the graph or the advisor chain silently stops \
                covering anything. Give the message a domain or time word (TurnGearAnalyzer), or — \
                if the test really does mean to exercise that gear, or never reaches the model at \
                all — say so with an adjacent `// gear-audited: <reason>` comment.""")
            .isEmpty();
    }

    /**
     * The literal text of a fixture argument: every inline string literal in it, concatenated.
     *
     * <p>Judging a concatenation on its literal halves alone is SOUND in the direction that
     * matters. {@code TurnGearAnalyzer} only ever ADDS signals as words arrive — a message is CHAT
     * because nothing in it referred to the user's data — so whatever the non-literal half
     * contributes at runtime (a fake's sentinel, a generated id, a date), it can never turn a
     * non-CHAT prefix back into CHAT. An argument with no literal at all is a different story:
     * there is nothing here to judge, and it needs an audit marker.
     *
     * @return the concatenated literal text, or {@code null} when the argument holds no literal
     */
    private static String literalTextOf(String argument) {
        StringBuilder text = new StringBuilder();
        boolean found = false;
        Matcher literal = STRING_LITERAL.matcher(argument);
        while (literal.find()) {
            found = true;
            text.append(literal.group(1).replace("\\\"", "\"").replace("\\\\", "\\"));
        }
        return found ? text.toString() : null;
    }

    private static List<Path> scannedFiles() throws IOException {
        try (Stream<Path> tree = Files.walk(TEST_ROOT)) {
            return tree
                .filter(path -> path.getFileName().toString().endsWith(".java"))
                .filter(path -> !path.getFileName().toString().equals(SELF))
                .filter(PromptOrderFixtureGearGuardTest::sendsATurn)
                .sorted()
                .toList();
        }
    }

    private static boolean sendsATurn(Path path) {
        try {
            return SENDS_A_TURN.matcher(Files.readString(path, StandardCharsets.UTF_8)).find();
        } catch (IOException e) {
            throw new IllegalStateException("cannot read " + path, e);
        }
    }

    /** The marker may sit on the call's own line or anywhere in the five lines above it. */
    private static boolean isAudited(List<String> lines, int line) {
        for (int i = Math.max(0, line - MARKER_WINDOW); i <= line && i < lines.size(); i++) {
            if (AUDIT_MARKER.matcher(lines.get(i)).find()) {
                return true;
            }
        }
        return false;
    }

    private static int lineOf(String source, int offset) {
        return (int) source.substring(0, offset).chars().filter(c -> c == '\n').count();
    }
}

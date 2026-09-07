package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.entity.ConferenceDeliberationEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Derives a {@link ConferenceDeliberationEnvelope} from a conference stored BEFORE the structured
 * column existed (mezo-xlvr, spec §8) — at READ time, never written back. The verdict and ruling
 * lines are machine-written by {@link KonziliumVerdictRound}, so they parse deterministically;
 * the proposal index is rebuilt exactly the way the round assigned it, by walking the expert
 * turns in transcript order and numbering their claim lines.
 *
 * <p>Legacy threads group BY EXPERT, titled with the expert's display name: a stored transcript
 * carries no chapter membership, and inventing one would misreport the meeting. Returns
 * {@code null} when the transcript has no expert turn to number — the caller then shows the
 * original prose view.
 *
 * <p><b>The index must be provable.</b> A proposal's text is appended verbatim and may itself
 * contain a newline, in which case counting lines would shift every later index and hang the
 * wrong verdict/ruling on a claim. Every expert turn's header states its own proposal count
 * ("{@code <Név>: N javaslat …}"); when a turn's claim-line count disagrees with that N — or the
 * header states no N at all — the transcript is not indexable and {@link #parse} returns
 * {@code null} for the WHOLE conference rather than deriving a threading it cannot prove
 * (mezo-xlvr final review, C1).
 *
 * <p><b>Persona keys collide.</b> {@code CharacterCoreCatalog} seeds the self-audit dimension with
 * expertKey {@code "szkeptikus"}, so a real transcript can carry TWO turns keyed that way: the
 * self-audit expert's own proposal turn, and {@code KonziliumVerdictRound}'s verdict turn. The
 * chair persona {@code "mezo"} similarly appears on a bootstrap turn that carries no ruling.
 * A turn is therefore classified by its CONTENT, not its persona key alone — a "szkeptikus" turn
 * is the verdict turn only if at least one line matches the verdict pattern, and a "mezo" turn is
 * the chair turn only if at least one line matches the ruling pattern. Both the verdict/ruling
 * collection pass and the threading pass use the same classification, so a turn is never counted
 * twice nor skipped by one pass and consumed by the other.
 */
public final class LegacyTranscriptParser {

    private static final Pattern SKEPTIC_LINE =
            Pattern.compile("^P(\\d+): (KEEP|KILL) — (.+)$");
    /** An expert turn's own header line, as {@link KonziliumProposalRound} writes it:
     *  "{@code <Név>: N javaslat …}". The N is the ONLY trustworthy statement of how many
     *  proposals that turn carries. */
    private static final Pattern EXPERT_HEADER =
            Pattern.compile("^.*: (\\d+) javaslat\\b.*$");
    private static final Pattern CHAIR_LINE =
            Pattern.compile("^P(\\d+): (ELFOGADVA|ELUTASÍTVA) \\(([^)]*)\\) — (.+)$");
    private static final String SKEPTIC_PERSONA = "szkeptikus";
    private static final String CHAIR_PERSONA = "mezo";
    private static final String CHAPTER_PREFIX = "Új fejezet: ";
    private static final String ACCEPTED = "ELFOGADVA";

    private LegacyTranscriptParser() {
    }

    public static ConferenceDeliberationEnvelope parse(List<ConferenceTranscriptEnvelope.Turn> turns) {
        if (turns == null || turns.isEmpty()) {
            return null;
        }

        Map<Integer, ConferenceDeliberationEnvelope.SkepticVerdict> verdicts = new LinkedHashMap<>();
        Map<Integer, ConferenceDeliberationEnvelope.ChairRuling> rulings = new LinkedHashMap<>();
        for (ConferenceTranscriptEnvelope.Turn turn : turns) {
            if (isVerdictTurn(turn)) {
                collectVerdicts(turn.text(), verdicts);
            } else if (isChairTurn(turn)) {
                collectRulings(turn.text(), rulings);
            }
        }

        List<ConferenceDeliberationEnvelope.Thread> threads = new ArrayList<>();
        int index = 0;
        for (ConferenceTranscriptEnvelope.Turn turn : turns) {
            if (isVerdictTurn(turn) || isChairTurn(turn)) {
                continue;
            }
            List<String> claimLines = claimLines(turn.text());
            if (claimLines.isEmpty()) {
                continue;
            }
            // A proposal's text is appended VERBATIM, and nothing forbids a newline inside it:
            // one such row would make every later line shift the shared proposal index, silently
            // attaching somebody else's verdict and ruling to a claim. The turn's own header
            // states how many proposals it carries — when the line count disagrees with it, the
            // transcript cannot be indexed at all, so the whole parse is refused and the caller
            // falls back to the prose view (mezo-xlvr final review, C1).
            Integer declared = declaredProposalCount(turn.text());
            if (declared == null || declared != claimLines.size()) {
                return null;
            }
            List<ConferenceDeliberationEnvelope.Item> items = new ArrayList<>();
            for (String claimLine : claimLines) {
                items.add(new ConferenceDeliberationEnvelope.Item(
                        index, turn.persona(), claimLine, null, null, false, List.of(),
                        verdicts.get(index), rulings.get(index)));
                index++;
            }
            threads.add(new ConferenceDeliberationEnvelope.Thread(null, displayName(turn.persona()), items));
        }

        return threads.isEmpty() ? null : new ConferenceDeliberationEnvelope(List.copyOf(threads));
    }

    /** A "szkeptikus"-keyed turn is the verdict turn only if it actually carries a verdict line —
     *  otherwise it is the self-audit expert's own proposal turn and must thread like any other
     *  expert's. */
    private static boolean isVerdictTurn(ConferenceTranscriptEnvelope.Turn turn) {
        return SKEPTIC_PERSONA.equals(turn.persona()) && anyLineMatches(turn.text(), SKEPTIC_LINE);
    }

    /** A "mezo"-keyed turn is the chair turn only if it actually carries a ruling line — the
     *  bootstrap council writes a "mezo" turn with only a header line and no rulings. */
    private static boolean isChairTurn(ConferenceTranscriptEnvelope.Turn turn) {
        return CHAIR_PERSONA.equals(turn.persona()) && anyLineMatches(turn.text(), CHAIR_LINE);
    }

    private static boolean anyLineMatches(String text, Pattern pattern) {
        if (text == null) {
            return false;
        }
        for (String line : text.split("\n")) {
            if (pattern.matcher(line.strip()).matches()) {
                return true;
            }
        }
        return false;
    }

    /** An expert turn's first line is its own header ("Drill: 2 javaslat …"); every further
     *  non-blank line is one proposal, in the order the round appended them. */
    private static List<String> claimLines(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }
        String[] lines = text.split("\n");
        List<String> claims = new ArrayList<>();
        for (int i = 1; i < lines.length; i++) {
            String line = lines[i].strip();
            if (!line.isEmpty()) {
                claims.add(line);
            }
        }
        return claims;
    }

    /** The proposal count the turn's header line states, or {@code null} when the header does
     *  not state one (an unrecognisable header is just as untrustworthy as a wrong count). */
    private static Integer declaredProposalCount(String text) {
        String header = text.split("\n", 2)[0].strip();
        Matcher matcher = EXPERT_HEADER.matcher(header);
        if (!matcher.matches()) {
            return null;
        }
        try {
            return Integer.valueOf(matcher.group(1));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static void collectVerdicts(String text,
                                         Map<Integer, ConferenceDeliberationEnvelope.SkepticVerdict> verdicts) {
        if (text == null) {
            return;
        }
        for (String line : text.split("\n")) {
            Matcher matcher = SKEPTIC_LINE.matcher(line.strip());
            if (matcher.matches()) {
                verdicts.put(Integer.parseInt(matcher.group(1)),
                        new ConferenceDeliberationEnvelope.SkepticVerdict(matcher.group(2), matcher.group(3)));
            }
        }
    }

    private static void collectRulings(String text,
                                        Map<Integer, ConferenceDeliberationEnvelope.ChairRuling> rulings) {
        if (text == null) {
            return;
        }
        for (String line : text.split("\n")) {
            String stripped = line.strip();
            if (stripped.startsWith(CHAPTER_PREFIX)) {
                continue;
            }
            Matcher matcher = CHAIR_LINE.matcher(stripped);
            if (matcher.matches()) {
                rulings.put(Integer.parseInt(matcher.group(1)),
                        new ConferenceDeliberationEnvelope.ChairRuling(
                                ACCEPTED.equals(matcher.group(2)),
                                confidenceOrNull(matcher.group(3)),
                                matcher.group(4)));
            }
        }
    }

    /** The chair line's confidence was rendered from a BigDecimal, but a hand-edited or older row
     *  can carry anything — an unreadable value becomes null rather than failing the whole parse. */
    private static BigDecimal confidenceOrNull(String raw) {
        try {
            return new BigDecimal(raw.strip());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** The catalog's display name, falling back to the raw persona key on catalog drift. */
    private static String displayName(String persona) {
        try {
            return CharacterExpertCatalog.byKey(persona).displayName();
        } catch (RuntimeException e) {
            return persona;
        }
    }
}

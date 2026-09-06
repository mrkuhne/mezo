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
 */
public final class LegacyTranscriptParser {

    private static final Pattern SKEPTIC_LINE =
            Pattern.compile("^P(\\d+): (KEEP|KILL) — (.+)$");
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
            if (SKEPTIC_PERSONA.equals(turn.persona())) {
                collectVerdicts(turn.text(), verdicts);
            } else if (CHAIR_PERSONA.equals(turn.persona())) {
                collectRulings(turn.text(), rulings);
            }
        }

        List<ConferenceDeliberationEnvelope.Thread> threads = new ArrayList<>();
        int index = 0;
        for (ConferenceTranscriptEnvelope.Turn turn : turns) {
            if (SKEPTIC_PERSONA.equals(turn.persona()) || CHAIR_PERSONA.equals(turn.persona())) {
                continue;
            }
            List<String> claimLines = claimLines(turn.text());
            if (claimLines.isEmpty()) {
                continue;
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

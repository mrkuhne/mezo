package io.mrkuhne.mezo.feature.companion.llm;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * {@link FakeCompanionLlm}'s deterministic twin of {@code FactMergeJudge} (S9, mezo-d6ivw.10).
 * Reads the {@code FactMergeJudge.MARKER}-prefixed prompt's own numbered sentence list back out
 * of the prompt text — never leaking real ids into the prompt keeps the ITs deterministic without
 * a scripted sentinel for every case.
 */
final class FakeFactMerge {

    private static final Pattern NUMBERED_LINE = Pattern.compile("(?m)^(\\d+)\\. (.*)$");
    private static final String COMBINE_TOKEN = "#comb";
    private static final String COMBINE_SENTENCE = "Összevont mondat a teszthez.";

    private FakeFactMerge() {
    }

    /**
     * Every DUPLICATE normalized sentence (lowercased, trailing {@code .!?} stripped) pairs up
     * as a {@code "same"} group; the first two lines carrying {@code #comb} pair up as a
     * {@code "combine"} group with a canned sentence. Anything else ⇒ {@code {"groups":[]}}.
     */
    static String answer(String systemPrompt) {
        Map<Integer, String> lines = new LinkedHashMap<>();
        Matcher matcher = NUMBERED_LINE.matcher(systemPrompt);
        while (matcher.find()) {
            lines.put(Integer.parseInt(matcher.group(1)), matcher.group(2));
        }

        List<Integer> combineMembers = lines.entrySet().stream()
                .filter(e -> e.getValue().contains(COMBINE_TOKEN))
                .map(Map.Entry::getKey)
                .limit(2)
                .toList();

        Map<String, List<Integer>> byNormalized = new LinkedHashMap<>();
        lines.forEach((index, text) -> byNormalized
                .computeIfAbsent(normalize(text), k -> new java.util.ArrayList<>())
                .add(index));

        StringBuilder groups = new StringBuilder();
        for (List<Integer> members : byNormalized.values()) {
            if (members.size() < 2) {
                continue;
            }
            if (!groups.isEmpty()) {
                groups.append(',');
            }
            groups.append("{\"verdict\":\"same\",\"members\":[")
                    .append(members.get(0)).append(',').append(members.get(1))
                    .append("],\"sentence\":\"\"}");
        }
        if (combineMembers.size() == 2) {
            if (!groups.isEmpty()) {
                groups.append(',');
            }
            groups.append("{\"verdict\":\"combine\",\"members\":[")
                    .append(combineMembers.get(0)).append(',').append(combineMembers.get(1))
                    .append("],\"sentence\":\"").append(COMBINE_SENTENCE).append("\"}");
        }
        return "{\"groups\":[" + groups + "]}";
    }

    private static String normalize(String text) {
        String trimmed = text.strip().toLowerCase(Locale.ROOT);
        return trimmed.replaceAll("[.!?]+$", "");
    }
}

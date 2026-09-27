package io.mrkuhne.mezo.feature.character.service.chat;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

public final class TeamChatExceptionMatcher {
    static final int TAG_MAX = 40;
    static final int KEYWORDS_MAX = 6;
    private TeamChatExceptionMatcher() {}

    static String fold(String s) {
        String n = Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return n.toLowerCase(Locale.ROOT);
    }
    public static String normalize(String tag) {
        String out = fold(tag).replaceAll("[^a-z0-9]+", " ").strip();
        return out.length() > TAG_MAX ? out.substring(0, TAG_MAX).strip() : out;
    }
    public static List<String> cleanKeywords(List<String> raw) {
        if (raw == null) return List.of();
        return raw.stream().filter(Objects::nonNull).map(k -> k.strip().toLowerCase(Locale.ROOT))
                .filter(k -> k.length() >= 2 && k.length() <= 24).distinct().limit(KEYWORDS_MAX).toList();
    }
    public static boolean matches(List<String> keywords, List<String> dayTexts) {
        if (keywords == null || keywords.isEmpty() || dayTexts == null) return false;
        String hay = fold(String.join(" \n ", dayTexts));
        return keywords.stream().map(TeamChatExceptionMatcher::fold).anyMatch(hay::contains);
    }
}

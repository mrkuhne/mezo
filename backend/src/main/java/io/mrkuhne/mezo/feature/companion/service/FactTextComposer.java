package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * S8 (mezo-d6ivw.12): a confirmed observation becomes a prompt-ready SENTENCE, not its title. The
 * mechanism carries the meaning (LLM text, a Q&A answer, or deterministic statistics); a
 * statistical row's mechanism is boilerplate ("r = …, n = …"), so those keep the title. Pure.
 * Capped at {@value #MAX_CHARS} — the knowledge fact edit cap ({@code UpdateFactRequest.factText}).
 */
public final class FactTextComposer {

    static final int MAX_CHARS = 500;
    /** The second sentence joins only while the pair stays this short. */
    static final int PAIR_MAX_CHARS = 280;

    /** Common Hungarian abbreviations whose trailing "." is not a sentence end. */
    private static final Set<String> ABBREVIATIONS = Set.of(
            "pl", "kb", "stb", "ill", "ún", "vö", "max", "min", "db", "ld", "lásd", "tkp", "ti", "uo", "szül",
            "ford");

    private static final Set<Character> OPENING_QUOTES = Set.of('"', '„', '“', '\'', '«');

    private FactTextComposer() {
    }

    public static String compose(String kind, String title, String mechanism) {
        if (PatternEntity.KIND_STATISTICAL.equals(kind) || mechanism == null || mechanism.isBlank()) {
            return title;
        }
        String[] sentences = splitSentences(mechanism.strip().replaceAll("\\s+", " "));
        String text = sentences[0];
        if (sentences.length > 1 && text.length() + 1 + sentences[1].length() <= PAIR_MAX_CHARS) {
            text = text + " " + sentences[1];
        }
        String result = text.length() <= MAX_CHARS ? text : cut(text);
        return isBalanced(result) ? result : title;
    }

    /**
     * Splits on a sentence-ending punctuation mark followed by whitespace, but only when the next
     * token looks like the start of a new sentence (an uppercase letter, or an opening quote
     * followed by one) AND the word right before the punctuation is not a common abbreviation
     * (e.g. "pl.", "kb.") — otherwise the mark is kept inside the current sentence.
     */
    private static String[] splitSentences(String text) {
        List<String> sentences = new ArrayList<>();
        int start = 0;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if ((c == '.' || c == '!' || c == '?' || c == '…') && i + 1 < text.length()
                    && text.charAt(i + 1) == ' ' && isSentenceStart(text, i + 2) && !isAbbreviationBefore(text, i)) {
                sentences.add(text.substring(start, i + 1));
                start = i + 2;
            }
        }
        if (start < text.length()) {
            sentences.add(text.substring(start));
        }
        return sentences.toArray(new String[0]);
    }

    private static boolean isSentenceStart(String text, int pos) {
        if (pos >= text.length()) {
            return false;
        }
        char c = text.charAt(pos);
        if (Character.isUpperCase(c)) {
            return true;
        }
        return OPENING_QUOTES.contains(c) && pos + 1 < text.length() && Character.isUpperCase(text.charAt(pos + 1));
    }

    private static boolean isAbbreviationBefore(String text, int dotIndex) {
        int wordEnd = dotIndex;
        int wordStart = wordEnd;
        while (wordStart > 0 && Character.isLetter(text.charAt(wordStart - 1))) {
            wordStart--;
        }
        if (wordStart == wordEnd) {
            return false;
        }
        return ABBREVIATIONS.contains(text.substring(wordStart, wordEnd).toLowerCase());
    }

    private static boolean isBalanced(String text) {
        int open = 0;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c == '(') {
                open++;
            } else if (c == ')') {
                open--;
            }
        }
        return open <= 0;
    }

    private static String cut(String text) {
        int limit = MAX_CHARS - 1;
        int space = text.lastIndexOf(' ', limit);
        return text.substring(0, space > 0 ? space : limit).stripTrailing() + "…";
    }
}

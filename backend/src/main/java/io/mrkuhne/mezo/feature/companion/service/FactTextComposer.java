package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import java.util.regex.Pattern;

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
    private static final Pattern SENTENCE_END = Pattern.compile("(?<=[.!?…])\\s+");

    private FactTextComposer() {
    }

    public static String compose(String kind, String title, String mechanism) {
        if (PatternEntity.KIND_STATISTICAL.equals(kind) || mechanism == null || mechanism.isBlank()) {
            return title;
        }
        String[] sentences = SENTENCE_END.split(mechanism.strip().replaceAll("\\s+", " "));
        String text = sentences[0];
        if (sentences.length > 1 && text.length() + 1 + sentences[1].length() <= PAIR_MAX_CHARS) {
            text = text + " " + sentences[1];
        }
        return text.length() <= MAX_CHARS ? text : cut(text);
    }

    private static String cut(String text) {
        int limit = MAX_CHARS - 1;
        int space = text.lastIndexOf(' ', limit);
        return text.substring(0, space > 0 ? space : limit).stripTrailing() + "…";
    }
}

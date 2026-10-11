package io.mrkuhne.mezo.feature.companion.llm;

import java.util.Set;

/**
 * The one sentence block that makes an LLM answer in the account's language (mezo-n4wf5.11).
 * Every prompt in the codebase is written in Hungarian, so Hungarian needs nothing; English gets a
 * directive APPENDED to the end of the system instructions. Appended, never prepended: the fake
 * LLM dispatches on the start of the prompt and OpenAI's prompt cache keys on the prefix, so the
 * Hungarian prompts must stay byte-identical and the English ones must share their prefix.
 */
public final class OutputLanguageDirective {

    /** Call-sites whose output is never read by a person: they must see exactly the prompt they always did. */
    static final Set<String> EXEMPT_SLUGS = Set.of("embed_memory", "companion_recall");

    static final String EN = """


        [OUTPUT LANGUAGE]
        The instructions and the data above are written in Hungarian. Write every sentence that a person will read in natural, idiomatic English, as a native speaker would.
        Keep JSON keys, enum values, tool names, ids and any value listed as a fixed option exactly as specified above — never translate them.
        Do not translate names, or text quoted from what the user wrote.""";

    private OutputLanguageDirective() {
    }

    /** {@code systemPrompt} unchanged (same instance) unless the language is English and the slug is not exempt. */
    public static String apply(String systemPrompt, String language, String slug) {
        if (systemPrompt == null || !"en".equals(language) || EXEMPT_SLUGS.contains(slug)) {
            return systemPrompt;
        }
        return systemPrompt + EN;
    }
}

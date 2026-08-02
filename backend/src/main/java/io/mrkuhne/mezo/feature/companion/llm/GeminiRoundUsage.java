package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.llmlog.service.TokenUsage;

/**
 * Per-call tally of the provider's PER-ROUND usage reports (mezo-58ig). One instance is created for
 * each {@link GeminiCompanionLlm} call and rides the ChatClient request context to
 * {@link GeminiRoundUsageAdvisor}, which adds every tool-loop round's own usage block into it.
 *
 * <p>Why summing is the honest record: each tool round is a separately billed provider call (round
 * N's prompt re-sends the whole context and Google bills it again), and Spring AI 2.0's tool loop
 * (ToolCallingAdvisor) returns the LAST round's response as the final one — nothing merges the
 * earlier rounds' usage on either the call or the stream path, so the adapter's final response
 * under-reports every counter and (via the cumulative {@code DefaultUsage} shapes) loses the
 * Google-native thoughts/cached fields entirely.
 *
 * <p>Null-aware like everything in the audit trail: a counter stays {@code null} until a round
 * actually reports it (a reported {@code 0} is a report — thinking off is not "unknown").
 * Synchronized because streamed rounds may report from Reactor threads.
 */
final class GeminiRoundUsage {

    /** The ChatClient request-context key the tally travels under (adapter → advisor). */
    static final String CONTEXT_KEY = GeminiRoundUsage.class.getName();

    private int rounds;
    private Integer prompt;
    private Integer candidates;
    private Integer thoughts;
    private Integer cached;
    private Integer total;

    /** One provider round's own usage block, exactly as reported. */
    synchronized void addRound(TokenUsage tokens) {
        if (tokens == null) {
            return;
        }
        rounds++;
        prompt = add(prompt, tokens.prompt());
        candidates = add(candidates, tokens.candidates());
        thoughts = add(thoughts, tokens.thoughts());
        cached = add(cached, tokens.cached());
        total = add(total, tokens.total());
    }

    synchronized boolean hasRounds() {
        return rounds > 0;
    }

    /** How many provider rounds reported usage — the loop ran {@code rounds() - 1} tool rounds. */
    synchronized int rounds() {
        return rounds;
    }

    synchronized TokenUsage toTokenUsage() {
        return new TokenUsage(prompt, candidates, thoughts, cached, total);
    }

    private static Integer add(Integer sum, Integer reported) {
        if (reported == null) {
            return sum;
        }
        return sum == null ? reported : sum + reported;
    }
}

package io.mrkuhne.mezo.feature.llmlog.repository;

/**
 * One feature's call/error rollup over a window (owner alerts, mezo-kjwa) — the source row for
 * the {@code llm_errors} rule. {@code total} counts every status; {@code errors} is the
 * {@code ERROR}-status subset.
 */
public interface LlmFeatureErrorRow {

    String getFeature();

    long getTotal();

    long getErrors();
}

package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import java.util.List;

/** Turns a conversational follow-up into a standalone retrieval query. */
public interface MemoryQueryRewriter {

    String rewrite(String currentQuery, List<CompanionLlm.Turn> boundedHistory);
}

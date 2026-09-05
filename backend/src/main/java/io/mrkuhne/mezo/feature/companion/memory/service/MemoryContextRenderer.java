package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryCandidate;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryContextItem;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryCandidateFusion.FusedCandidate;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/** Renders selected memories without cutting item content and with explicit provenance indicators. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryContextRenderer {

    private static final String HEADER = "[Hosszú távú memória]\n";
    private static final int CHARS_PER_TOKEN = 3;

    private final MemoryPlatformProperties properties;

    public String render(List<MemoryContextItem> items, int maxTokenBudget) {
        int maxChars = Math.max(0, maxTokenBudget) * CHARS_PER_TOKEN;
        if (items.isEmpty() || HEADER.length() > maxChars) {
            return "";
        }
        StringBuilder result = new StringBuilder(HEADER);
        for (MemoryContextItem item : items) {
            String line = line(item.label(), item.occurredOn(), item.indicator(), item.content());
            if (result.length() + line.length() > maxChars) {
                continue;
            }
            result.append(line);
        }
        return result.length() == HEADER.length() ? "" : result.toString().stripTrailing();
    }

    public String indicator(MemoryCandidate candidate, LocalDate asOf) {
        List<String> indicators = new ArrayList<>();
        if (candidate.conflicting()) {
            indicators.add("conflict");
        }
        if (candidate.sourceKind().contains("weekly") || candidate.sourceKind().contains("monthly")) {
            indicators.add("summary");
        }
        if (candidate.occurredOn() != null && asOf != null
                && ChronoUnit.DAYS.between(candidate.occurredOn(), asOf) > properties.indicators().oldAfterDays()) {
            indicators.add("old");
        }
        return String.join("+", indicators);
    }

    static int headerLength() {
        return HEADER.length();
    }

    int candidateLineLength(FusedCandidate candidate, LocalDate asOf) {
        MemoryCandidate item = candidate.candidate();
        return line(item.label(), item.occurredOn(), indicator(item, asOf), item.content()).length();
    }

    private static String line(String label, LocalDate occurredOn, String indicator, String content) {
        String safeLabel = label == null || label.isBlank() ? "emlék" : label;
        String date = occurredOn == null ? "n/a" : occurredOn.toString();
        String marker = indicator == null || indicator.isBlank() ? "" : "|" + indicator;
        return "- " + safeLabel + "|" + date + marker + "|" + content + "\n";
    }
}

package io.mrkuhne.mezo.feature.penz.service.news;

import java.util.List;
import java.util.UUID;

/**
 * The slice of a holding the news pipeline needs (mezo-r36n9.104): {@code assetType} bond|etf|stock|fund|crypto|cash,
 * {@code sleeve} short|mid|long, {@code currency} its ISO code, {@code newsTerms} the owner's own search words.
 */
public record NewsHolding(UUID id, String name, String symbol, String currency, String assetType, String sleeve,
                          List<String> newsTerms) {

    public NewsHolding {
        newsTerms = newsTerms == null ? List.of() : List.copyOf(newsTerms);
    }

    public boolean isBond() {
        return "bond".equals(assetType);
    }

    public boolean isForeignCurrency() {
        return currency != null && !"HUF".equalsIgnoreCase(currency);
    }
}

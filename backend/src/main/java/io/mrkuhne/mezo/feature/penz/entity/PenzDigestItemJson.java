package io.mrkuhne.mezo.feature.penz.entity;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * One stored digest item — an element of {@code penz_digest.items} (jsonb), shaped 1:1 like the contract's
 * {@code PenzDigestItem} (mezo-r36n9.104): {@code kind} holding|fx|rates, {@code sleeve} short|mid|long or null,
 * {@code holdingName} from his ledger (never from the model), {@code effectHufMinor} computed by the backend,
 * {@code effectNote} fixed copy, {@code narratedBy} model|fallback.
 */
public record PenzDigestItemJson(String id, String kind, UUID holdingId, String holdingName, String sleeve, String title,
                                 long effectHufMinor, String effectNote, BigDecimal changePct, int confidence,
                                 String verdict, String body, String uncertainty, String noAction, Instant publishedAt,
                                 List<Source> sources, String narratedBy) {

    public static final String NARRATED_BY_MODEL = "model";
    public static final String NARRATED_BY_FALLBACK = "fallback";

    public PenzDigestItemJson {
        sources = sources == null ? List.of() : List.copyOf(sources);
    }

    /** One source of the item — {@code PenzDigestSource}. */
    public record Source(String name, String title, String url, Instant publishedAt) {
    }
}

package io.mrkuhne.mezo.feature.gamification;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Static title content (spec §7, MIX tone: serious LADDER progression / playful SHOP purchases),
 * loaded at startup from a classpath JSON — the {@link io.mrkuhne.mezo.feature.progression.PerkCatalog}
 * loading idiom. In-memory master content (no table, no created_by) — per-user ownership lives in
 * the owned_title table. Invalid content fails startup fast.
 */
@Component
@RequiredArgsConstructor
public class TitleCatalog {

    /** Every new gamification profile starts equipped with this title. */
    public static final String DEFAULT_TITLE_KEY = "ujonc";

    private static final String KIND_LADDER = "LADDER";
    private static final String KIND_SHOP = "SHOP";
    private static final Set<String> KINDS = Set.of(KIND_LADDER, KIND_SHOP);

    /** One title as authored in content/gamification-titles.json. */
    public record TitleDef(String key, String name, String kind, Integer unlockLevel, Integer priceCoins) {}

    private final ObjectMapper objectMapper; // SB4 Jackson 3 (tools.jackson)
    private final Map<String, TitleDef> byKey = new LinkedHashMap<>();

    @PostConstruct
    void loadFromClasspath() {
        load(readContent());
    }

    /** Validates every item, then assigns by key. Package-private for the fail-fast IT. */
    void load(List<TitleDef> items) {
        items.forEach(this::validateRow);
        Map<String, TitleDef> next = new LinkedHashMap<>();
        for (TitleDef d : items) {
            if (next.put(d.key(), d) != null) {
                throw new IllegalStateException("Duplicate gamification-titles key: " + d.key());
            }
        }
        if (!next.containsKey(DEFAULT_TITLE_KEY)) {
            throw new IllegalStateException(
                "content/gamification-titles.json is missing the default title key: " + DEFAULT_TITLE_KEY);
        }
        byKey.clear();
        byKey.putAll(next);
    }

    /** All catalog titles, authored order. */
    public List<TitleDef> all() {
        return List.copyOf(byKey.values());
    }

    /** A single title by key, if it exists in the catalog. */
    public Optional<TitleDef> find(String key) {
        return Optional.ofNullable(byKey.get(key));
    }

    private List<TitleDef> readContent() {
        try (InputStream in = new ClassPathResource("content/gamification-titles.json").getInputStream()) {
            return objectMapper.readValue(in,
                objectMapper.getTypeFactory().constructCollectionType(List.class, TitleDef.class));
        } catch (IOException e) {
            throw new IllegalStateException("content/gamification-titles.json is unreadable", e);
        }
    }

    private void validateRow(TitleDef d) {
        boolean ladder = KIND_LADDER.equals(d.kind());
        boolean shop = KIND_SHOP.equals(d.kind());
        boolean valid = d.key() != null && !d.key().isBlank()
            && d.name() != null && !d.name().isBlank()
            && KINDS.contains(d.kind())
            && (ladder == (d.unlockLevel() != null))
            && (shop == (d.priceCoins() != null));
        if (!valid) {
            throw new IllegalStateException("Invalid gamification-titles item: key=" + d.key()
                + " kind=" + d.kind());
        }
    }
}

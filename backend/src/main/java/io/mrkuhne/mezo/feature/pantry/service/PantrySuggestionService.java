package io.mrkuhne.mezo.feature.pantry.service;

import io.mrkuhne.mezo.api.dto.PantrySource;
import io.mrkuhne.mezo.api.dto.PantrySuggestionResponse;
import io.mrkuhne.mezo.feature.pantry.config.PantrySuggestionProperties;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Deterministic Kamra swap suggestions (Fuel P6, mezo-bka) — computed at read over the user's
 * own items, never persisted, never LLM. Two heuristics, both within one category:
 * <ol>
 *   <li><b>Cheaper alternative</b> — the cheapest priced item costs at most
 *       {@code cheaperRatio} x the priciest one (same {@code priceUnit} basis).</li>
 *   <li><b>Low-NOVA swap</b> — an item with NOVA >= 3 has a NOVA <= 2 neighbour.
 *       (Live catalog NOVA is currently NULL-heavy — mezo-32ko — so this yields honest-empty
 *       until the backfill; the math is fixture-proven.)</li>
 * </ol>
 * Output is capped at {@code maxItems}, ordered by category name for stable rendering.
 */
@Service
@RequiredArgsConstructor
public class PantrySuggestionService {

    private final PantrySuggestionProperties props;

    public List<PantrySuggestionResponse> suggest(List<PantryItemEntity> items) {
        Map<String, List<PantryItemEntity>> byCategory = items.stream()
            .filter(e -> "food".equals(e.getKind()) && e.getCategory() != null)
            .collect(Collectors.groupingBy(PantryItemEntity::getCategory, TreeMap::new, Collectors.toList()));

        List<PantrySuggestionResponse> out = new ArrayList<>();
        Set<String> suggestedNames = new LinkedHashSet<>();
        for (List<PantryItemEntity> group : byCategory.values()) {
            cheaperAlternative(group, out, suggestedNames);
            lowNovaSwap(group, out, suggestedNames);
        }
        return out.size() > props.maxItems() ? out.subList(0, props.maxItems()) : out;
    }

    private void cheaperAlternative(List<PantryItemEntity> group,
                                    List<PantrySuggestionResponse> out, Set<String> seen) {
        // Prices are only comparable on the same priceUnit basis (e.g. "/kg" vs "/db").
        Map<String, List<PantryItemEntity>> byPriceUnit = group.stream()
            .filter(e -> e.getPriceHuf() != null && e.getPriceUnit() != null)
            .collect(Collectors.groupingBy(PantryItemEntity::getPriceUnit, TreeMap::new, Collectors.toList()));
        for (List<PantryItemEntity> priced : byPriceUnit.values()) {
            if (priced.size() < 2) continue;
            PantryItemEntity cheap = priced.stream().min(Comparator.comparing(PantryItemEntity::getPriceHuf)).orElseThrow();
            PantryItemEntity dear = priced.stream().max(Comparator.comparing(PantryItemEntity::getPriceHuf)).orElseThrow();
            BigDecimal threshold = BigDecimal.valueOf(dear.getPriceHuf()).multiply(props.cheaperRatio());
            if (BigDecimal.valueOf(cheap.getPriceHuf()).compareTo(threshold) > 0) continue;
            int savedPct = 100 - BigDecimal.valueOf(cheap.getPriceHuf() * 100L)
                .divide(BigDecimal.valueOf(dear.getPriceHuf()), 0, RoundingMode.HALF_UP).intValue();
            add(out, seen, cheap, "Olcsóbb, mint a(z) " + dear.getName() + " (−" + savedPct + "%)");
        }
    }

    private void lowNovaSwap(List<PantryItemEntity> group,
                             List<PantrySuggestionResponse> out, Set<String> seen) {
        List<PantryItemEntity> withNova = group.stream().filter(e -> e.getNova() != null).toList();
        PantryItemEntity high = withNova.stream().filter(e -> e.getNova() >= 3)
            .max(Comparator.comparing(PantryItemEntity::getNova)).orElse(null);
        PantryItemEntity low = withNova.stream().filter(e -> e.getNova() <= 2)
            .min(Comparator.comparing(PantryItemEntity::getNova)).orElse(null);
        if (high == null || low == null) return;
        add(out, seen, low, "NOVA " + high.getNova() + " → NOVA " + low.getNova()
            + " csere a(z) " + high.getName() + " helyett");
    }

    private void add(List<PantrySuggestionResponse> out, Set<String> seen,
                     PantryItemEntity item, String reason) {
        if (!seen.add(item.getName())) return;
        out.add(PantrySuggestionResponse.builder()
            .name(item.getName())
            .source(PantrySource.fromValue(item.getSource()))
            .price(formatPrice(item))
            .reason(reason)
            .build());
    }

    private String formatPrice(PantryItemEntity item) {
        if (item.getPriceHuf() == null) return "—";
        return item.getPriceHuf() + " Ft" + (item.getPriceUnit() == null ? "" : item.getPriceUnit());
    }
}

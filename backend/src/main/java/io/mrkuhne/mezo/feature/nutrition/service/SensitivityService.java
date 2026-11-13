package io.mrkuhne.mezo.feature.nutrition.service;

import io.mrkuhne.mezo.api.dto.SensitivityItem;
import io.mrkuhne.mezo.api.dto.SensitivityNovaRule;
import io.mrkuhne.mezo.api.dto.SensitivityProfileRequest;
import io.mrkuhne.mezo.api.dto.SensitivityProfileResponse;
import io.mrkuhne.mezo.feature.nutrition.entity.SensitivityProfileEntity;
import io.mrkuhne.mezo.feature.nutrition.repository.SensitivityProfileRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The owner's food sensitivities (Boop B4, mezo-r36n9.14, spec §7.1). Persistence and wire mapping
 * live here; {@link #verdict} is the pure rule set — ALLERGY blocks on TRACES and on unknown,
 * INTOLERANCE and AVOID only on CONTAINS, the NOVA rule behaves like AVOID. A verdict never stops
 * anything from being logged; it only tells the suggester what to leave out.
 */
@Service
@RequiredArgsConstructor
public class SensitivityService {

    static final String UNKNOWN_TEXT = "nincs adat";
    static final String CONTAINS_TEXT = "tartalmazza";
    static final String TRACES_TEXT = "nyomokban tartalmazhatja";
    static final String NOVA_KEY = "nova";

    private final SensitivityProfileRepository repository;

    /** The saved profile, or the defaults when no row exists — never 404. */
    @Transactional(readOnly = true)
    public SensitivityProfile profile(UUID userId) {
        return repository.findByCreatedByAndDeletedFalse(userId)
            .map(SensitivityService::toProfile)
            .orElseGet(SensitivityProfile::defaults);
    }

    @Transactional
    public SensitivityProfile save(UUID userId, SensitivityProfile profile) {
        SensitivityProfileEntity row = repository.findByCreatedByAndDeletedFalse(userId)
            .orElseGet(() -> {
                SensitivityProfileEntity e = new SensitivityProfileEntity();
                e.setCreatedBy(userId); // server-side from principal, never from client
                return e;
            });
        row.setItems(new ArrayList<>(profile.items()));
        row.setNovaEnabled(profile.novaRule().enabled());
        row.setNovaMaxLevel(profile.novaRule().maxLevel());
        return toProfile(repository.save(row));
    }

    // The controller calls these, so the transaction boundary lives HERE: self-invoking the
    // annotated profile()/save() below would bypass the Spring proxy.
    @Transactional(readOnly = true)
    public SensitivityProfileResponse getResponse(UUID userId) {
        return toResponse(profile(userId));
    }

    @Transactional
    public SensitivityProfileResponse setResponse(UUID userId, SensitivityProfileRequest req) {
        return toResponse(save(userId, fromRequest(req)));
    }

    public static SensitivityVerdict verdict(SensitivityProfile profile, Map<String, AllergenState> allergens) {
        return verdict(profile, allergens, null);
    }

    /** {@code nova} is the food's NOVA level (1..4) or null when unclassified. */
    public static SensitivityVerdict verdict(
            SensitivityProfile profile, Map<String, AllergenState> allergens, Integer nova) {
        boolean blocks = false;
        List<SensitivityVerdict.Warning> warnings = new ArrayList<>();
        for (Sensitivity s : profile.items()) {
            if (!AllergenKeys.isEu14(s.key())) {
                continue; // free text: no structured allergen state, matched by name elsewhere
            }
            AllergenState state = allergens.getOrDefault(s.key(), AllergenState.UNKNOWN);
            String text = switch (s.level()) {
                case ALLERGY -> switch (state) {
                    case CONTAINS -> CONTAINS_TEXT;
                    case TRACES -> TRACES_TEXT;
                    case UNKNOWN -> UNKNOWN_TEXT; // unknown is never safe for an allergy
                };
                case INTOLERANCE, AVOID -> state == AllergenState.CONTAINS ? CONTAINS_TEXT : null;
            };
            if (text != null) {
                blocks = true;
                warnings.add(new SensitivityVerdict.Warning(s.key(), text));
            }
        }
        NovaRule rule = profile.novaRule();
        if (rule != null && rule.enabled() && nova != null && nova > rule.maxLevel()) {
            blocks = true;
            warnings.add(new SensitivityVerdict.Warning(NOVA_KEY, "feldolgozottság: " + nova));
        }
        return new SensitivityVerdict(blocks, List.copyOf(warnings));
    }

    private static SensitivityProfile toProfile(SensitivityProfileEntity e) {
        return new SensitivityProfile(
            e.getItems() == null ? List.of() : List.copyOf(e.getItems()),
            new NovaRule(e.isNovaEnabled(), e.getNovaMaxLevel()));
    }

    private static SensitivityProfile fromRequest(SensitivityProfileRequest req) {
        List<Sensitivity> items = req.getItems().stream()
            .map(i -> new Sensitivity(normalizeKey(i.getKey()), SensitivityLevel.fromWire(i.getLevel().getValue()), i.getNote()))
            .toList();
        return new SensitivityProfile(items,
            new NovaRule(req.getNovaRule().getEnabled(), req.getNovaRule().getMaxLevel()));
    }

    /** Keys are stored lowercase so "Milk"/"PEANUTS" match the EU-14 keys instead of silently becoming free text. */
    static String normalizeKey(String key) {
        return key.strip().toLowerCase(java.util.Locale.ROOT);
    }

    private static SensitivityProfileResponse toResponse(SensitivityProfile p) {
        return SensitivityProfileResponse.builder()
            .items(p.items().stream()
                .map(s -> SensitivityItem.builder()
                    .key(s.key())
                    .level(SensitivityItem.LevelEnum.fromValue(s.level().wire()))
                    .note(s.note())
                    .build())
                .toList())
            .novaRule(SensitivityNovaRule.builder()
                .enabled(p.novaRule().enabled())
                .maxLevel(p.novaRule().maxLevel())
                .build())
            .build();
    }
}

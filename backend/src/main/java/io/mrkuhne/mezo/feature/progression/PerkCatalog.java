package io.mrkuhne.mezo.feature.progression;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Static perk content (skillKey + milestone → perk title + estimated-effect copy), loaded at
 * startup from a classpath JSON. In-memory master content (no table, no created_by) — the
 * per-user unlocks live in the perk_unlock table. Invalid content fails startup fast.
 */
@Component
@RequiredArgsConstructor
public class PerkCatalog {

    /** One perk as authored in content/progression-perks.json. */
    public record PerkDef(String skillKey, int milestoneLevel, String perkKey, String name, String effectCopy) {}

    private final ObjectMapper objectMapper; // SB4 Jackson 3 (tools.jackson)
    private final Map<String, PerkDef> byKey = new HashMap<>();

    @jakarta.annotation.PostConstruct
    void load() {
        for (PerkDef p : readContent()) {
            validate(p);
            byKey.put(key(p.skillKey(), p.milestoneLevel()), p);
        }
    }

    /** The perk defined for a skill at a milestone level, if any. */
    public Optional<PerkDef> find(String skillKey, int milestoneLevel) {
        return Optional.ofNullable(byKey.get(key(skillKey, milestoneLevel)));
    }

    private static String key(String skillKey, int milestoneLevel) {
        return skillKey + "#" + milestoneLevel;
    }

    private List<PerkDef> readContent() {
        try (InputStream in = new ClassPathResource("content/progression-perks.json").getInputStream()) {
            return objectMapper.readValue(in,
                objectMapper.getTypeFactory().constructCollectionType(List.class, PerkDef.class));
        } catch (IOException e) {
            throw new IllegalStateException("content/progression-perks.json is unreadable", e);
        }
    }

    private void validate(PerkDef p) {
        boolean valid = p.skillKey() != null && !p.skillKey().isBlank()
            && p.perkKey() != null && !p.perkKey().isBlank()
            && p.name() != null && !p.name().isBlank()
            && p.effectCopy() != null && !p.effectCopy().isBlank()
            && p.milestoneLevel() >= 1;
        if (!valid) {
            throw new IllegalStateException("Invalid progression-perks item: skillKey=" + p.skillKey()
                + " milestoneLevel=" + p.milestoneLevel() + " perkKey=" + p.perkKey());
        }
    }
}

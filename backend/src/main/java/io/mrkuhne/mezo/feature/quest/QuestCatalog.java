package io.mrkuhne.mezo.feature.quest;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Static quest content (catalog key → slot/skill/copy/metric/XP), loaded at startup from a
 * classpath JSON. In-memory master content (no table, no created_by) — the per-user offered
 * quests live in the daily_quest table. Invalid content fails startup fast (ADR 0010 band).
 */
@Component
@RequiredArgsConstructor
public class QuestCatalog {

    /** One quest as authored in content/quest-catalog.json. */
    public record QuestDef(String key, String slot, String skillKey, String skillKind,
        String title, String why, String mode, String metric, BigDecimal threshold, int xp, int coins,
        int difficulty, List<String> dayTypes, boolean requiresGoalPrescription, int cooldownDays) {}

    private static final Set<String> SLOTS = Set.of("BODY", "FUELBIO", "GROWTH");
    private static final Set<String> MODES = Set.of("DERIVED", "ACTIVITY");
    private static final Set<String> DAY_TYPES = Set.of("GYM", "REST", "ANY");
    private static final Set<String> SKILL_KINDS = Set.of("ATHLETIC", "MUSCLE", "LIFE");

    private final ObjectMapper objectMapper; // SB4 Jackson 3 (tools.jackson)
    private List<QuestDef> defs = List.of();

    @jakarta.annotation.PostConstruct
    void load() {
        List<QuestDef> read = readContent();
        read.forEach(this::validate);
        defs = List.copyOf(read);
    }

    public List<QuestDef> all() {
        return defs;
    }

    private List<QuestDef> readContent() {
        try (InputStream in = new ClassPathResource("content/quest-catalog.json").getInputStream()) {
            return objectMapper.readValue(in,
                objectMapper.getTypeFactory().constructCollectionType(List.class, QuestDef.class));
        } catch (IOException e) {
            throw new IllegalStateException("content/quest-catalog.json is unreadable", e);
        }
    }

    private void validate(QuestDef d) {
        boolean valid = d.key() != null && !d.key().isBlank()
            && SLOTS.contains(d.slot())
            && d.skillKey() != null && !d.skillKey().isBlank()
            && SKILL_KINDS.contains(d.skillKind())
            && d.title() != null && !d.title().isBlank()
            && d.why() != null && !d.why().isBlank()
            && MODES.contains(d.mode())
            && d.metric() != null && !d.metric().isBlank()
            && d.xp() >= 15 && d.xp() <= 40
            && d.coins() == 0
            && d.dayTypes() != null && !d.dayTypes().isEmpty() && DAY_TYPES.containsAll(d.dayTypes())
            && d.cooldownDays() >= 0;
        if (!valid) {
            throw new IllegalStateException("Invalid quest-catalog item: key=" + d.key());
        }
    }
}

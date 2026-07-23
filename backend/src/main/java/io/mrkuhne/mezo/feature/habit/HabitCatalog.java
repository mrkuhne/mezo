package io.mrkuhne.mezo.feature.habit;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/** Static habit content, loaded fail-fast at startup (the QuestCatalog pattern). */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.HABIT_SWITCH, havingValue = "true")
public class HabitCatalog {

    public static final String CHAIN_MORNING = "MORNING";
    public static final String CHAIN_EVENING = "EVENING";
    public static final String MODE_DERIVED = "DERIVED";
    public static final String MODE_MANUAL = "MANUAL";

    private static final Set<String> CHAINS = Set.of(CHAIN_MORNING, CHAIN_EVENING);
    private static final Set<String> MODES = Set.of(MODE_DERIVED, MODE_MANUAL);

    public record HabitDef(String key, String chain, int position, String title, String why,
        String anchorCopy, String mode, String metric, String skillKey, String skillKind, int xp,
        String linkUrl) {}

    private final ObjectMapper objectMapper; // SB4 Jackson 3 (tools.jackson)
    private List<HabitDef> defs = List.of();

    @PostConstruct
    void load() {
        List<HabitDef> read = readCatalog();
        read.forEach(this::validate);
        defs = read.stream()
            .sorted(Comparator.comparing(HabitDef::chain).thenComparing(HabitDef::position))
            .toList();
    }

    private List<HabitDef> readCatalog() {
        try (InputStream in = new ClassPathResource("content/habit-catalog.json").getInputStream()) {
            return objectMapper.readValue(in,
                objectMapper.getTypeFactory().constructCollectionType(List.class, HabitDef.class));
        } catch (IOException e) {
            throw new IllegalStateException("content/habit-catalog.json is unreadable", e);
        }
    }

    private void validate(HabitDef d) {
        boolean ok = d.key() != null && !d.key().isBlank()
            && CHAINS.contains(d.chain())
            && MODES.contains(d.mode())
            && d.position() >= 1
            && "LIFE".equals(d.skillKind())
            && d.xp() >= 5 && d.xp() <= 15
            && d.metric() != null && !d.metric().isBlank()
            && (MODE_MANUAL.equals(d.mode()) == "manual".equals(d.metric()));
        if (!ok) {
            throw new IllegalStateException("Invalid habit-catalog item: key=" + d.key());
        }
    }

    public List<HabitDef> all() {
        return defs;
    }

    public Optional<HabitDef> byKey(String key) {
        return defs.stream().filter(d -> d.key().equals(key)).findFirst();
    }

    public List<HabitDef> forChain(String chain) {
        return defs.stream().filter(d -> d.chain().equals(chain)).toList();
    }
}

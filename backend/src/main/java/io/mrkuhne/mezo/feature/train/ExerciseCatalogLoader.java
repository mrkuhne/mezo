package io.mrkuhne.mezo.feature.train;

import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * Startup content loader for the curated exercise catalog. Runs in EVERY profile (the catalog
 * is content needed in prod too — unlike the {@code demodata}/{@code demofixtures} seeders) and
 * upserts by {@code slug}: missing rows are inserted, drifted fields updated, nothing is ever
 * deleted. Content tuning = edit {@code content/exercise-catalog.json}; Liquibase owns schema
 * only. Invalid content (unknown muscle/type token, missing field) fails startup fast instead
 * of surfacing as a runtime 500 later.
 */
@Component
@Order(50) // before TrainSeedData(100); independent of the demodata owner
@RequiredArgsConstructor
public class ExerciseCatalogLoader implements CommandLineRunner {

    private static final Set<String> MUSCLES = Set.of(
        "back-mid", "lats", "chest", "shoulder", "rear-delt", "biceps", "triceps",
        "quad", "ham", "glute", "calf", "core", "traps");
    private static final Set<String> TYPES = Set.of("compound", "isolation", "plyo");

    private final ExerciseCatalogRepository repository;
    private final ObjectMapper objectMapper; // SB4 Jackson 3 (tools.jackson)

    /** One catalog row as authored in content/exercise-catalog.json. */
    public record CatalogJsonItem(
        String slug, String name, String muscle, String type, BigDecimal stim, BigDecimal fatigue) {}

    // Same self-invocation note as TrainSeedData: startup enters via run(String...), the IT
    // calls run() through the proxy — both overloads carry @Transactional.
    @Override
    @Transactional
    public void run(String... args) {
        run();
    }

    /** No-arg overload — used by the integration test to re-run against a drifted DB. */
    @Transactional
    public void run() {
        load(readContent());
    }

    private List<CatalogJsonItem> readContent() {
        try (InputStream in = new ClassPathResource("content/exercise-catalog.json").getInputStream()) {
            return objectMapper.readValue(in,
                objectMapper.getTypeFactory().constructCollectionType(List.class, CatalogJsonItem.class));
        } catch (IOException e) {
            throw new IllegalStateException("content/exercise-catalog.json is unreadable", e);
        }
    }

    /** Validates every item, then upserts by slug. Package-private for the fail-fast IT. */
    @Transactional
    void load(List<CatalogJsonItem> items) {
        items.forEach(this::validate);
        Map<String, ExerciseCatalogEntity> bySlug = new HashMap<>();
        repository.findAll().forEach(e -> bySlug.put(e.getSlug(), e));
        for (CatalogJsonItem item : items) {
            ExerciseCatalogEntity e = bySlug.getOrDefault(item.slug(), new ExerciseCatalogEntity());
            e.setSlug(item.slug());
            e.setName(item.name());
            e.setMuscle(item.muscle());
            e.setType(item.type());
            e.setStim(item.stim());
            e.setFatigue(item.fatigue());
            repository.save(e);
        }
    }

    private void validate(CatalogJsonItem item) {
        boolean valid = item.slug() != null && !item.slug().isBlank()
            && item.name() != null && !item.name().isBlank()
            && MUSCLES.contains(item.muscle()) && TYPES.contains(item.type())
            && item.stim() != null && item.fatigue() != null;
        if (!valid) {
            throw new IllegalStateException("Invalid exercise-catalog item: " + item.slug());
        }
    }
}

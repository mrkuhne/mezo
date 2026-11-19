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

    static final Set<String> MUSCLES = Set.of(
        "chest-upper", "chest-mid", "chest-lower", "back-wide", "back-mid", "back-lower", "traps",
        "shoulder-front", "shoulder-side", "shoulder-rear", "biceps-long", "biceps-short",
        "biceps-brachialis", "triceps-long", "triceps-lateral", "triceps-medial",
        "quad", "ham", "glute", "calf", "core");
    private static final Set<String> TYPES = Set.of("compound", "isolation", "plyo");
    private static final Set<String> EQUIPMENT = Set.of(
        "machine", "cable", "dumbbell", "barbell", "bodyweight", "kettlebell", "other");
    private static final Set<String> STABILITY = Set.of("stable", "free");

    // Selection attributes (mezo-r36n9.66, spec 2026-11-17-boop-gyakorlatvalasztas-design §6.1).
    // Package-private so the pure content test checks the JSON against the same sets. GEAR is the
    // finer, multi-valued kit list the swap filters on ("Mi van a termemben"); EQUIPMENT above is
    // the single primary kind of mezo-r36n9.79. `lengthened` (loaded at a stretch) is a different
    // notion from `lengthenedFriendly` (safe for lengthened partials) and is kept apart.
    public static final Set<String> GEAR = Set.of(
        "barbell", "dumbbell", "kettlebell", "cable", "machine", "smith", "bench", "pullup-bar",
        "bodyweight", "specialty");
    static final Set<String> PATTERNS = Set.of(
        "horizontal-push", "vertical-push", "horizontal-pull", "vertical-pull", "squat", "lunge",
        "hinge", "knee-flexion", "knee-extension", "hip-extension", "hip-abduction",
        "elbow-flexion", "elbow-extension", "raise", "fly", "calf-raise", "shrug",
        "trunk-flexion", "trunk-stability", "carry", "jump");
    static final Set<String> JOINTS = Set.of(
        "shoulder", "elbow", "wrist", "lower-back", "hip", "knee", "ankle");
    static final Set<String> DEMANDS = Set.of("low", "medium", "high");

    private final ExerciseCatalogRepository repository;
    private final ObjectMapper objectMapper; // SB4 Jackson 3 (tools.jackson)

    /**
     * One catalog row as authored in content/exercise-catalog.json. The six selection attributes
     * (gear … demand) are appended last; they are validated here and persisted
     * on master rows (mezo-r36n9.66).
     */
    public record CatalogJsonItem(
        String slug, String name, String muscle, String type, BigDecimal stim, BigDecimal fatigue,
        String videoUrl, String imageStartUrl, String imageEndUrl,
        String equipment, String stability, Boolean lengthenedFriendly,
        List<String> gear, String pattern, List<String> secondaryMuscles, List<String> joints,
        Boolean lengthened, String demand) {}

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
            // The classification is content, not user data: always overwritten from the file (drift heals).
            e.setEquipment(item.equipment());
            e.setStability(item.stability());
            e.setLengthenedFriendly(item.lengthenedFriendly());
            // Selection attributes (mezo-r36n9.66): same content-overwrite rule; user rows are never in the file.
            e.setGear(item.gear());
            e.setPattern(item.pattern());
            e.setSecondaryMuscles(item.secondaryMuscles());
            e.setJoints(item.joints());
            e.setLengthened(item.lengthened());
            e.setDemand(item.demand());
            // Seed a JSON demo only when provided AND the row has none — never clobber a user video.
            if (item.videoUrl() != null && e.getVideoUrl() == null) {
                e.setVideoUrl(item.videoUrl());
            }
            // Same rule for the demo stills (mezo-8xdl.1): a redeploy must not overwrite an image
            // the user attached in-app. The two frames are seeded independently.
            if (item.imageStartUrl() != null && e.getImageStartUrl() == null) {
                e.setImageStartUrl(item.imageStartUrl());
            }
            if (item.imageEndUrl() != null && e.getImageEndUrl() == null) {
                e.setImageEndUrl(item.imageEndUrl());
            }
            repository.save(e);
        }
    }

    private void validate(CatalogJsonItem item) {
        boolean valid = item.slug() != null && !item.slug().isBlank()
            && item.name() != null && !item.name().isBlank()
            && MUSCLES.contains(item.muscle()) && TYPES.contains(item.type())
            && item.stim() != null && item.fatigue() != null
            && item.equipment() != null && EQUIPMENT.contains(item.equipment())
            && item.stability() != null && STABILITY.contains(item.stability())
            && item.lengthenedFriendly() != null
            && validAttributes(item);
        if (!valid) {
            throw new IllegalStateException("Invalid exercise-catalog item: " + item.slug());
        }
    }

    /**
     * Selection attributes of a master row (spec §6.1): at least one known gear kind, and
     * {@code bodyweight} only on its own; one known pattern; 0–3 known secondary muscles, never
     * the row's own; known joints; a non-null {@code lengthened}; a known demand.
     */
    private static boolean validAttributes(CatalogJsonItem item) {
        List<String> equipment = item.gear();
        List<String> secondary = item.secondaryMuscles();
        return equipment != null && !equipment.isEmpty() && GEAR.containsAll(equipment)
            && (!equipment.contains("bodyweight") || equipment.size() == 1)
            && PATTERNS.contains(item.pattern())
            && secondary != null && secondary.size() <= 3 && MUSCLES.containsAll(secondary)
            && !secondary.contains(item.muscle())
            && item.joints() != null && JOINTS.containsAll(item.joints())
            && item.lengthened() != null
            && DEMANDS.contains(item.demand());
    }
}

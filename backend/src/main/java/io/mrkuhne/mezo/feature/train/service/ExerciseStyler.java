package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.TrainStyleProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesoTemplateEntity;
import io.mrkuhne.mezo.feature.train.entity.json.GymExerciseJson;
import io.mrkuhne.mezo.feature.train.entity.json.MesoDayJson;
import io.mrkuhne.mezo.feature.train.mapper.TrainMapper;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Applies a block's training style to the exercises of a save (mezo-r36n9.79): the carry-over of the
 * style fields a client omitted, then {@link StyleStamper} on every exercise, with the catalog
 * stability read once per save through {@link CatalogAttributes}. Shared by the template save, the
 * run day edit, the custom-workout save and the mid-workout swap/add, so the four write paths cannot
 * drift apart. Also computes the read-only {@code effectiveTrainingStyle} of a response exercise.
 *
 * <p>An unstyled block is a no-op (spec §11.3): nothing is stamped and no catalog is read; only the
 * exercise's own style fields are persisted (and carried over) as sent.
 */
@Component
@RequiredArgsConstructor
public class ExerciseStyler {

    private final CatalogAttributes catalogAttributes;
    private final TrainStyleProperties props;
    private final TrainMapper mapper;

    /** Template save: carry over per day (same index in the days array), then stamp every exercise. */
    public List<MesoDayJson> styleTemplateDays(List<MesoDayJson> stored, List<MesoDayJson> incoming,
                                               TrainingStyle block) {
        List<MesoDayJson> carried = new ArrayList<>(incoming.size());
        for (int d = 0; d < incoming.size(); d++) {
            MesoDayJson day = incoming.get(d);
            List<GymExerciseJson> before = stored != null && d < stored.size() ? stored.get(d).exercises() : List.of();
            carried.add(withExercises(day, carry(before, day.exercises())));
        }
        CatalogAttributes.Lookup stability = lookup(
            carried.stream().flatMap(d -> d.exercises().stream()).toList(), block);
        return carried.stream().map(day -> withExercises(day, day.exercises().stream()
            .map(e -> StyleStamper.stamp(e, block, stability.stable(e.catalogId()), props)).toList())).toList();
    }

    /**
     * Run rows (day edit, custom workout, swap/add): carry over from the rows the save replaces, then
     * stamp under the block's style, written straight onto the fresh (unsaved) entities. Returns the
     * stability lookup it read, so the caller's response reuses it instead of reading again.
     */
    public CatalogAttributes.Lookup styleRows(List<ExerciseEntity> fresh, List<ExerciseEntity> replaced, TrainingStyle block) {
        List<GymExerciseJson> carried = carry(replaced.stream().map(mapper::toExerciseJson).toList(),
            fresh.stream().map(mapper::toExerciseJson).toList());
        CatalogAttributes.Lookup stability = lookup(carried, block);
        for (int i = 0; i < fresh.size(); i++) {
            GymExerciseJson e = carried.get(i);
            if (!fresh.get(i).isCountsTowardVolume()) {
                continue; // closing block / plyo rows keep their own fixed prescription
            }
            applyTo(fresh.get(i), StyleStamper.stamp(e, block, stability.stable(e.catalogId()), props));
        }
        return stability;
    }

    /** Stability of every catalog id that can matter: none at all when nothing is styled (no query). */
    public CatalogAttributes.Lookup lookupRows(Collection<ExerciseEntity> rows, boolean anyBlockStyled) {
        return catalogAttributes.load(rows.stream()
            .filter(r -> anyBlockStyled)
            .map(ExerciseEntity::getCatalogId).toList());
    }

    /** One stability read across several templates (the template list). */
    public CatalogAttributes.Lookup lookupTemplates(Collection<MesoTemplateEntity> templates) {
        return catalogAttributes.load(templates.stream().filter(t -> t.getTrainingStyle() != null)
            .flatMap(t -> t.getDays().stream()).flatMap(d -> d.exercises().stream())
            .map(GymExerciseJson::catalogId).toList());
    }

    public CatalogAttributes.Lookup lookup(Collection<GymExerciseJson> exercises, TrainingStyle block) {
        return catalogAttributes.load(exercises.stream()
            .filter(e -> block != null)
            .map(GymExerciseJson::catalogId).toList());
    }

    /**
     * The style the stamp actually used: the exercise's own style, else the block's, after the
     * all-out-on-free fallback; null for an unstyled block (even when the exercise has a style) and
     * for plyo and every row that does not count toward volume (never stamped).
     */
    public io.mrkuhne.mezo.api.dto.TrainingStyle effective(String exerciseStyle, String type, UUID catalogId,
                                                           TrainingStyle block, CatalogAttributes.Lookup stability,
                                                           boolean countsTowardVolume) {
        if (block == null || !countsTowardVolume) {
            return null;
        }
        TrainingStyle style = exerciseStyle != null ? TrainingStyle.fromWire(exerciseStyle) : block;
        boolean stable = stability.stable(catalogId);
        ExerciseClass cls = ExerciseClass.of(type, stable);
        if (cls == null) {
            return null;
        }
        // legs only moves the reserve, never the effective style
        return io.mrkuhne.mezo.api.dto.TrainingStyle.fromValue(
            StyleTable.stamp(style, cls, stable, false, props).effectiveStyle().wire());
    }

    /**
     * Carries {@code trainingStyle}/{@code restSec}/{@code overrides} over from the stored exercise
     * the incoming one replaces — same identity (catalog id, else exact name), first unmatched — when
     * the request omits them. {@code trainingStyle} and {@code restSec} carry one by one when null;
     * {@code overrides} carries only when the exercise sent no style field at all (the frozen web
     * client), because the contract cannot tell an omitted list from an empty one (both store null).
     */
    static List<GymExerciseJson> carry(List<GymExerciseJson> stored, List<GymExerciseJson> incoming) {
        boolean[] used = new boolean[stored.size()];
        List<GymExerciseJson> out = new ArrayList<>(incoming.size());
        for (GymExerciseJson in : incoming) {
            GymExerciseJson match = null;
            for (int j = 0; j < stored.size(); j++) {
                if (!used[j] && sameIdentity(in, stored.get(j))) {
                    used[j] = true;
                    match = stored.get(j);
                    break;
                }
            }
            if (match == null) {
                out.add(in);
                continue;
            }
            boolean sentNone = in.trainingStyle() == null && in.restSec() == null && in.overrides() == null;
            out.add(new GymExerciseJson(in.id(), in.name(), in.muscle(), in.warmupSets(), in.workingSets(),
                in.repMin(), in.repMax(), in.targetRir(), in.anchorWeightKg(), in.type(), in.warning(),
                in.catalogId(), in.countsTowardVolume(),
                in.trainingStyle() != null ? in.trainingStyle() : match.trainingStyle(),
                in.restSec() != null ? in.restSec() : match.restSec(),
                sentNone ? match.overrides() : in.overrides()));
        }
        return out;
    }

    private static boolean sameIdentity(GymExerciseJson a, GymExerciseJson b) {
        return a.catalogId() != null
            ? a.catalogId().equals(b.catalogId())
            : b.catalogId() == null && Objects.equals(a.name(), b.name());
    }

    /** Writes the stamped prescription and the style fields onto a run row. */
    static void applyTo(ExerciseEntity row, GymExerciseJson stamped) {
        row.setWorkingSets(stamped.workingSets());
        row.setRepMin(stamped.repMin());
        row.setRepMax(stamped.repMax());
        row.setTargetRir(stamped.targetRir());
        row.setTrainingStyle(stamped.trainingStyle());
        row.setRestSec(stamped.restSec());
        row.setOverrides(stamped.overrides() == null ? null : new ArrayList<>(stamped.overrides()));
    }

    private static MesoDayJson withExercises(MesoDayJson day, List<GymExerciseJson> exercises) {
        return new MesoDayJson(day.day(), day.type(), day.muscle(), day.muscleAccent(), day.note(), exercises);
    }
}

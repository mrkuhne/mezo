package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
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
        carried = clearInvalidCarriedDays(carried, incoming);
        CatalogAttributes.Lookup stability = lookup(
            carried.stream().flatMap(d -> d.exercises().stream()).toList(), block);
        return carried.stream().map(day -> withExercises(day, day.exercises().stream()
            .map(e -> noneAsNull(StyleStamper.stamp(e, block, stability.stable(e.catalogId()), props))).toList()))
            .toList();
    }

    /**
     * Run rows (day edit, custom workout, swap/add): carry over from the rows the save replaces, then
     * stamp under the block's style, written straight onto the fresh (unsaved) entities. Returns the
     * stability lookup it read, so the caller's response reuses it instead of reading again.
     */
    public CatalogAttributes.Lookup styleRows(List<ExerciseEntity> fresh, List<ExerciseEntity> replaced, TrainingStyle block) {
        return styleRows(fresh, replaced, block, null);
    }

    /**
     * As {@link #styleRows(List, List, TrainingStyle)}, with the request's inputs (same order as
     * {@code fresh}): an entity cannot tell an absent technique field from a sent default, so the
     * carry-over reads "was it sent" from the input, never from the half-built row.
     */
    public CatalogAttributes.Lookup styleRows(List<ExerciseEntity> fresh, List<ExerciseEntity> replaced,
                                              TrainingStyle block, List<GymExerciseInput> inputs) {
        List<GymExerciseJson> incoming = new ArrayList<>(fresh.size());
        for (int i = 0; i < fresh.size(); i++) {
            GymExerciseJson row = mapper.toExerciseJson(fresh.get(i));
            GymExerciseJson sent = inputs == null ? null : mapper.toExerciseJson(inputs.get(i));
            incoming.add(sent == null ? row
                : row.withTechnique(sent.technique(), sent.techniqueSource(), sent.challenge()));
        }
        List<GymExerciseJson> carried = clearInvalidCarried(
            carry(replaced.stream().map(mapper::toExerciseJson).toList(), incoming), incoming);
        CatalogAttributes.Lookup stability = lookup(carried, block);
        for (int i = 0; i < fresh.size(); i++) {
            GymExerciseJson e = carried.get(i);
            applyTechniqueTo(fresh.get(i), e);
            if (!fresh.get(i).isCountsTowardVolume()) {
                continue; // closing block / plyo rows keep their own fixed prescription
            }
            applyTo(fresh.get(i), StyleStamper.stamp(e, block, stability.stable(e.catalogId()), props));
        }
        return stability;
    }

    /**
     * A run's block style changed (mezo-r36n9.83): re-stamps the EXISTING rows in place under the new block
     * style — ids, order and technique picks untouched, an exercise's own style and the owner's overrides
     * respected exactly as on a save (the rows are their own carry-over source, so nothing needs carrying).
     * Rows that do not count toward volume keep their fixed prescription. Returns the stability lookup.
     */
    public CatalogAttributes.Lookup restampRows(List<ExerciseEntity> rows, TrainingStyle block) {
        List<GymExerciseJson> current = rows.stream().map(mapper::toExerciseJson).toList();
        CatalogAttributes.Lookup stability = lookup(current, block);
        for (int i = 0; i < rows.size(); i++) {
            if (!rows.get(i).isCountsTowardVolume()) {
                continue;
            }
            GymExerciseJson e = current.get(i);
            applyTo(rows.get(i), StyleStamper.stamp(e, block, stability.stable(e.catalogId()), props));
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
     * The training style of one exercise of a run's day (mezo-r36n9.79): the exercise's own style, else the
     * run's; the stamp of that style for the exercise's class gives the rep overshoot and the fallback
     * rest; the row's (already stamped) reserve is ramped across the run's weeks — never below the free
     * floor on a free exercise. {@link StyleContext#NONE} for an unstyled run, for plyo (never stamped) and
     * for a row that does not count toward volume. {@code week} is the run's 1-based current week as the
     * session sees it. Shared by {@code WorkoutService.getToday} and {@link LoadLinePreview}, so the
     * weekly proposal's load preview and the session's prescription use the same context.
     */
    public StyleContext context(ExerciseEntity e, TrainingStyle runStyle, int week, List<String> phaseCurve,
                                CatalogAttributes.Lookup stability) {
        if (runStyle == null || !e.isCountsTowardVolume()) {
            return StyleContext.NONE;
        }
        TrainingStyle style = e.getTrainingStyle() != null ? TrainingStyle.fromWire(e.getTrainingStyle()) : runStyle;
        boolean stable = stability.stable(e.getCatalogId());
        ExerciseClass cls = ExerciseClass.of(e.getType(), stable);
        if (cls == null) {
            return StyleContext.NONE;
        }
        StyleTable.Stamp stamp = StyleTable.stamp(style, cls, stable, StyleStamper.legs(cls, e.getMuscle()), props);
        int base = e.getTargetRir() != null ? e.getTargetRir() : stamp.reserve();
        int reserve = EffortRamp.effectiveReserve(base, week, phaseCurve, !stable, props.ramp());
        return new StyleContext(stamp.effectiveStyle(), reserve,
            e.getRestSec() != null ? e.getRestSec() : Integer.valueOf(stamp.restSec()), stamp.repOverflow());
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
                out.add(withOwnerSource(in));
                continue;
            }
            boolean sentNone = in.trainingStyle() == null && in.restSec() == null && in.overrides() == null;
            // Technique fields (mezo-r36n9.80): a client that sends none of them (the frozen web client) keeps
            // the stored pick; one that sends any is taken as-is, so an explicit "none" / false clears it.
            boolean techniqueSent = in.technique() != null || in.techniqueSource() != null || in.challenge() != null;
            GymExerciseJson base = new GymExerciseJson(in.id(), in.name(), in.muscle(), in.warmupSets(),
                in.workingSets(), in.repMin(), in.repMax(), in.targetRir(), in.anchorWeightKg(), in.type(),
                in.warning(), in.catalogId(), in.countsTowardVolume(),
                in.trainingStyle() != null ? in.trainingStyle() : match.trainingStyle(),
                in.restSec() != null ? in.restSec() : match.restSec(),
                sentNone ? match.overrides() : in.overrides(), null, null, null);
            GymExerciseJson merged = techniqueSent
                ? base.withTechnique(in.technique(), in.techniqueSource(), in.challenge())
                : base.withTechnique(match.technique(), match.techniqueSource(), match.challenge());
            out.add(techniqueSent ? withOwnerSource(merged) : merged);
        }
        return out;
    }

    private static boolean techniqueSent(GymExerciseJson in) {
        return in.technique() != null || in.techniqueSource() != null || in.challenge() != null;
    }

    /**
     * A pick the request did not send but only carried over may have become invalid (the catalog row
     * changed under it): clear it rather than block an unrelated save, as a swap does. Rows the request
     * did send are left for {@link TechniqueGuard} to reject.
     */
    private List<MesoDayJson> clearInvalidCarriedDays(List<MesoDayJson> carried, List<MesoDayJson> incoming) {
        List<GymExerciseJson> flat = carried.stream().flatMap(d -> d.exercises().stream()).toList();
        List<GymExerciseJson> sent = incoming.stream().flatMap(d -> d.exercises().stream()).toList();
        List<GymExerciseJson> cleared = clearInvalidCarried(flat, sent).stream().toList();
        List<MesoDayJson> out = new ArrayList<>(carried.size());
        int at = 0;
        for (MesoDayJson day : carried) {
            out.add(withExercises(day, cleared.subList(at, at + day.exercises().size())));
            at += day.exercises().size();
        }
        return out;
    }

    private List<GymExerciseJson> clearInvalidCarried(List<GymExerciseJson> carried, List<GymExerciseJson> incoming) {
        List<UUID> ids = new ArrayList<>();
        for (int i = 0; i < carried.size(); i++) {
            if (!techniqueSent(incoming.get(i)) && carriesPick(carried.get(i))) {
                ids.add(carried.get(i).catalogId());
            }
        }
        if (ids.isEmpty()) {
            return carried; // nothing carried carries a pick: no catalog read
        }
        CatalogAttributes.AttrsLookup attrs = catalogAttributes.loadAttrs(ids);
        List<GymExerciseJson> out = new ArrayList<>(carried.size());
        for (int i = 0; i < carried.size(); i++) {
            GymExerciseJson e = carried.get(i);
            boolean invalid = !techniqueSent(incoming.get(i)) && carriesPick(e)
                && TechniqueRules.check(Technique.fromWire(e.technique()), Boolean.TRUE.equals(e.challenge()),
                    attrs.of(e.catalogId())).isPresent();
            out.add(invalid ? e.withTechnique(null, null, false) : e);
        }
        return out;
    }

    private static boolean carriesPick(GymExerciseJson e) {
        Technique t = Technique.fromWire(e.technique());
        return (t != null && t != Technique.NONE) || Boolean.TRUE.equals(e.challenge());
    }

    /** T2 is the only writer of technique picks: what a request sets is the owner's (none / false clears the source). */
    private static GymExerciseJson withOwnerSource(GymExerciseJson e) {
        boolean active = (e.technique() != null && !"none".equals(e.technique())) || Boolean.TRUE.equals(e.challenge());
        String source = active ? "owner" : null;
        if (Objects.equals(source, e.techniqueSource())) {
            return e;
        }
        return e.withTechnique(e.technique(), source, e.challenge());
    }

    private static boolean sameIdentity(GymExerciseJson a, GymExerciseJson b) {
        return a.catalogId() != null
            ? a.catalogId().equals(b.catalogId())
            : b.catalogId() == null && Objects.equals(a.name(), b.name());
    }

    /** "none" is stored as null everywhere (readers treat null as none); the wire "none" only means "clear it". */
    static GymExerciseJson noneAsNull(GymExerciseJson e) {
        return "none".equals(e.technique()) ? e.withTechnique(null, e.techniqueSource(), e.challenge()) : e;
    }

    /** Writes the carried technique fields onto a run row (mezo-r36n9.80). */
    static void applyTechniqueTo(ExerciseEntity row, GymExerciseJson e) {
        row.setTechnique(noneAsNull(e).technique());
        row.setTechniqueSource(e.techniqueSource());
        row.setChallenge(Boolean.TRUE.equals(e.challenge()));
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

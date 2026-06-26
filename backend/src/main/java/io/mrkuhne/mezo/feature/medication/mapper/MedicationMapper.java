package io.mrkuhne.mezo.feature.medication.mapper;

import io.mrkuhne.mezo.api.dto.MedicationCycleCell;
import io.mrkuhne.mezo.api.dto.MedicationCycleConfig;
import io.mrkuhne.mezo.api.dto.MedicationCycleResponse;
import io.mrkuhne.mezo.api.dto.MedicationDayResponse;
import io.mrkuhne.mezo.api.dto.MedicationDoseResponse;
import io.mrkuhne.mezo.api.dto.MedicationPhase;
import io.mrkuhne.mezo.api.dto.MedicationRequest;
import io.mrkuhne.mezo.api.dto.MedicationResponse;
import io.mrkuhne.mezo.feature.medication.entity.MedicationCycleJson;
import io.mrkuhne.mezo.feature.medication.entity.MedicationDoseEntity;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.medication.service.dto.MedicationCycle;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.mapstruct.Mapper;

/**
 * READ-ONLY projection of the medication aggregate + the derived {@link MedicationCycle} onto their
 * contract responses, plus the single write seam ({@link #applyRequest}). Mirrors {@code MealMapper}:
 * a {@code @Mapper(componentModel="spring")} interface with {@code default} methods so the
 * jsonb/derived shapes ({@link MedicationCycleJson}, {@link MedicationCycle}) are mapped explicitly
 * rather than by name-match.
 *
 * <p>The derived {@link MedicationCycle} (Task 5) is NOT a contract type — it is the service-layer
 * intermediate; {@link #toCycleResponse} projects it onto {@code MedicationCycleResponse}, turning
 * each {@link MedicationCycle.Cell} into a {@code MedicationCycleCell} (the {@code current} flag
 * survives) and {@code lastDoseAt} {@code Instant} → {@code OffsetDateTime} (UTC). The entity's
 * typed jsonb {@link MedicationCycleJson} maps to the {@code MedicationCycleConfig} sub-DTO.
 */
@Mapper(componentModel = "spring")
public interface MedicationMapper {

    /** Catalog row → contract response (typed jsonb {@code cycle} → {@code MedicationCycleConfig}). */
    default MedicationResponse toResponse(MedicationEntity e) {
        return MedicationResponse.builder()
            .id(e.getId())
            .name(e.getName())
            .activeIngredient(e.getActiveIngredient())
            .route(e.getRoute())
            .cadence(e.getCadence())
            .defaultDose(e.getDefaultDose())
            .doseUnit(e.getDoseUnit())
            .cycle(toCycleConfig(e.getCycle()))
            .active(e.isActive())
            .build();
    }

    /** Derived cycle view → contract response; cells map 1:1, {@code lastDoseAt} Instant → date-time. */
    default MedicationCycleResponse toCycleResponse(MedicationCycle c) {
        List<MedicationCycleCell> week = c.week() == null ? List.of()
            : c.week().stream().map(this::toCell).toList();
        return MedicationCycleResponse.builder()
            .retaDay(c.retaDay())
            .phaseKey(c.phaseKey())
            .phaseLabel(c.phaseLabel())
            .lastDoseAt(toOffset(c.lastDoseAt()))
            .week(week)
            .build();
    }

    /** Ledger row → contract dose response ({@code administeredAt} Instant → date-time). */
    default MedicationDoseResponse toDoseResponse(MedicationDoseEntity d) {
        return MedicationDoseResponse.builder()
            .id(d.getId())
            .administeredAt(toOffset(d.getAdministeredAt()))
            .dose(d.getDose())
            .note(d.getNote())
            .build();
    }

    /** The full "Gyógyszer" day payload: medication + derived cycle + the recent intake ledger. */
    default MedicationDayResponse toDay(
        MedicationEntity e, MedicationCycle cycle, List<MedicationDoseEntity> recentDoses) {
        List<MedicationDoseResponse> doses = recentDoses == null ? List.of()
            : recentDoses.stream().map(this::toDoseResponse).toList();
        return MedicationDayResponse.builder()
            .medication(toResponse(e))
            .cycle(toCycleResponse(cycle))
            .recentDoses(doses)
            .build();
    }

    /** Apply a PUT body's definition + cycle config onto the entity (write seam; service owns the rest). */
    default void applyRequest(MedicationEntity e, MedicationRequest req) {
        e.setName(req.getName());
        e.setActiveIngredient(req.getActiveIngredient());
        e.setRoute(req.getRoute());
        e.setCadence(req.getCadence());
        e.setDefaultDose(req.getDefaultDose());
        e.setDoseUnit(req.getDoseUnit());
        e.setCycle(toCycleJson(req.getCycle()));
        if (req.getActive() != null) {
            e.setActive(req.getActive());
        }
    }

    /** One derived cell → contract cell; the {@code current} marker passes straight through. */
    default MedicationCycleCell toCell(MedicationCycle.Cell cell) {
        return MedicationCycleCell.builder()
            .day(cell.day())
            .phaseKey(cell.phaseKey())
            .label(cell.label())
            .current(cell.current())
            .build();
    }

    /** Typed jsonb cycle envelope → contract {@code MedicationCycleConfig} sub-DTO. */
    default MedicationCycleConfig toCycleConfig(MedicationCycleJson json) {
        if (json == null) {
            return null;
        }
        List<MedicationPhase> phases = json.phases() == null ? List.of()
            : json.phases().stream().map(this::toPhase).toList();
        return MedicationCycleConfig.builder()
            .cycleLengthDays(json.cycleLengthDays())
            .phases(phases)
            .build();
    }

    /** Jsonb phase → contract phase (the {@code key} String resolves to the enum value). */
    default MedicationPhase toPhase(MedicationCycleJson.Phase p) {
        return MedicationPhase.builder()
            .key(MedicationPhase.KeyEnum.fromValue(p.key()))
            .fromDay(p.fromDay())
            .toDay(p.toDay())
            .label(p.label())
            .build();
    }

    /** Contract {@code MedicationCycleConfig} → typed jsonb envelope (inverse of {@link #toCycleConfig}). */
    default MedicationCycleJson toCycleJson(MedicationCycleConfig config) {
        if (config == null) {
            return null;
        }
        List<MedicationCycleJson.Phase> phases = config.getPhases() == null ? List.of()
            : config.getPhases().stream()
                .map(p -> new MedicationCycleJson.Phase(
                    p.getKey() == null ? null : p.getKey().getValue(),
                    p.getFromDay(), p.getToDay(), p.getLabel()))
                .toList();
        return new MedicationCycleJson(config.getCycleLengthDays(), phases);
    }

    /** Entity {@code Instant} → contract {@code OffsetDateTime} (UTC). */
    default OffsetDateTime toOffset(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}

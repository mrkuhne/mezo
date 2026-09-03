package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.api.dto.MedicationCycleResponse;
import io.mrkuhne.mezo.api.dto.MedicationDayResponse;
import io.mrkuhne.mezo.api.dto.MedicationDoseResponse;
import io.mrkuhne.mezo.api.dto.MedicationResponse;
import io.mrkuhne.mezo.feature.medication.entity.MedicationDoseEntity;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.medication.repository.MedicationDoseRepository;
import io.mrkuhne.mezo.feature.medication.repository.MedicationRepository;
import io.mrkuhne.mezo.feature.medication.service.MedicationCycleService;
import io.mrkuhne.mezo.feature.medication.service.MedicationService;
import io.mrkuhne.mezo.feature.medication.service.dto.MedicationCycle;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/** V0.5 read tool over the medication feature (cycle position + general dose ledger). NEVER advises dosing (spec §6). */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MedicationTools {

    /** get_medication's supported scope values; anything else (incl. null) falls back to "cycle". */
    private static final List<String> MEDICATION_SCOPES = List.of("cycle", "all");

    private final MedicationRepository medicationRepository;
    private final MedicationDoseRepository medicationDoseRepository;
    private final MedicationCycleService medicationCycleService;
    /** Pure read (its {@code @Transactional}/save/delete are on OTHER methods; {@link
     *  MedicationService#getDay} only) — ungated (no {@code @ConditionalOnProperty} on the class),
     *  so injected directly (the {@code ProgressionService}/{@code GrowthWeekService} precedent). */
    private final MedicationService medicationService;

    @Tool(name = "get_medication", description = "Gyógyszer: ciklusállás vagy általános "
            + "gyógyszer-áttekintés. scope=cycle (alapértelmezés) — az aktív gyógyszer ciklusállása: "
            + "hányadik nap, fázis, utolsó dózis, következő esedékes nap, utolsó dózisok. scope=all — az "
            + "aktív gyógyszer általános adatai: név, hatóanyag, adagolási rend, alapdózis, ciklusállás "
            + "(ha van már rögzített dózis), utolsó dózisok. Használd, amikor a user a gyógyszeréről / a "
            + "gyógyszer-ciklusáról kérdez. scope: cycle (alapértelmezés), all.")
    public String getMedication(
            @ToolParam(required = false, description = "cycle|all (alapértelmezés: cycle).") String scope,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        String s = normalizeScope(scope);
        return "all".equals(s) ? renderAll(userId, toolContext) : renderCycle(userId, toolContext);
    }

    private static String normalizeScope(String scope) {
        if (scope == null) {
            return "cycle";
        }
        String s = scope.trim().toLowerCase();
        return MEDICATION_SCOPES.contains(s) ? s : "cycle";
    }

    /** scope=cycle (default) — the medication cycle position + the recent dose ledger. */
    private String renderCycle(UUID userId, ToolContext toolContext) {
        MedicationEntity med =
                medicationRepository.findFirstByCreatedByAndActiveTrueAndDeletedFalse(userId).orElse(null);
        if (med == null) {
            return "Gyógyszer-ciklus: " + ToolText.NO_DATA;
        }
        LocalDate today = LocalDate.now();
        MedicationCycle cycle = medicationCycleService.derive(userId, med, today);
        if (cycle.cycleDay() == 0) {
            // honest zero — active med but no recorded dose to anchor the cycle
            return "Gyógyszer-ciklus: " + med.getName() + " — nincs rögzített dózis";
        }
        List<MedicationDoseEntity> doses = medicationDoseRepository
                .findTop10ByCreatedByAndMedicationIdAndDeletedFalseOrderByAdministeredAtDesc(userId, med.getId());
        MedicationDoseEntity last = doses.getFirst();
        StringBuilder b = new StringBuilder("Gyógyszer-ciklus: ").append(med.getName())
                .append(" — ").append(cycle.cycleDay()).append(". nap (").append(cycle.phaseLabel()).append(')')
                .append("; utolsó dózis: ").append(last.getAdministeredDate())
                .append(" (").append(ToolText.num(last.getDose())).append(' ').append(med.getDoseUnit()).append(')');
        if (med.getCycle() != null) {
            b.append("; következő esedékes: ")
                    .append(last.getAdministeredDate().plusDays(med.getCycle().cycleLengthDays()));
        }
        if (doses.size() > 1) {
            b.append("\nUtolsó dózisok: ").append(doses.stream().limit(5)
                    .map(d -> d.getAdministeredDate() + ": " + ToolText.num(d.getDose()) + " " + med.getDoseUnit())
                    .collect(Collectors.joining("; ")));
        }
        ToolContexts.audit(toolContext).addRef("Medication", med.getName());
        return b.toString();
    }

    /**
     * scope=all — the general medications view over {@link MedicationService#getDay}: name, active
     * ingredient, dosing regimen (cadence + default dose), and — once at least one dose is on record
     * — the cycle position and recent doses. No brand-specific naming: renders whichever medication
     * the owner has active, generically. "nincs adat" only when the owner has no active medication
     * at all (checked via {@link #medicationRepository} first, mirroring {@link #renderCycle}'s own
     * null-med check — {@code getDay} answers an EMPTY payload in that case (mezo-5cmq), which this
     * renderer has nothing to say about); the "no dose yet" case (cycle day 0) is
     * an honest partial render — name/regimen without a cycle line — never an absence.
     */
    private String renderAll(UUID userId, ToolContext toolContext) {
        MedicationEntity med =
                medicationRepository.findFirstByCreatedByAndActiveTrueAndDeletedFalse(userId).orElse(null);
        if (med == null) {
            return "Gyógyszer: " + ToolText.NO_DATA;
        }
        MedicationDayResponse day = medicationService.getDay(userId);
        MedicationResponse m = day.getMedication();
        MedicationCycleResponse cycle = day.getCycle();
        StringBuilder b = new StringBuilder("Gyógyszer: ").append(m.getName())
                .append(" (").append(m.getActiveIngredient()).append(") — ").append(m.getCadence())
                .append(", ").append(ToolText.num(m.getDefaultDose())).append(' ').append(m.getDoseUnit());
        if (cycle != null && cycle.getCycleDay() != null && cycle.getCycleDay() > 0) {
            b.append("; ciklus: ").append(cycle.getCycleDay()).append(". nap (").append(cycle.getPhaseLabel())
                    .append(')');
        }
        List<MedicationDoseResponse> doses = day.getRecentDoses();
        if (doses != null && !doses.isEmpty()) {
            b.append("\nUtolsó dózisok: ").append(doses.stream().limit(5)
                    .map(d -> d.getAdministeredAt().toLocalDate() + ": " + ToolText.num(d.getDose())
                            + " " + m.getDoseUnit())
                    .collect(Collectors.joining("; ")));
        }
        ToolContexts.audit(toolContext).addRef("Medication", m.getName());
        return b.toString();
    }
}

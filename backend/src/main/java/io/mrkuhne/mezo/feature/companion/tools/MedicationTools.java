package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.feature.medication.entity.MedicationDoseEntity;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.medication.repository.MedicationDoseRepository;
import io.mrkuhne.mezo.feature.medication.repository.MedicationRepository;
import io.mrkuhne.mezo.feature.medication.service.MedicationCycleService;
import io.mrkuhne.mezo.feature.medication.service.dto.MedicationCycle;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/** V0.5 read tool over the medication feature (Reta cycle + dose ledger). NEVER advises dosing (spec §6). */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MedicationTools {

    private final MedicationRepository medicationRepository;
    private final MedicationDoseRepository medicationDoseRepository;
    private final MedicationCycleService medicationCycleService;

    @Tool(name = "get_reta_cycle", description = "Az aktív gyógyszer (retatrutid) ciklusállása: hányadik "
            + "nap, fázis, utolsó dózis, következő esedékes nap, utolsó dózisok. Kérdés a Reta-ciklusról.")
    public String getRetaCycle(ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        MedicationEntity med =
                medicationRepository.findFirstByCreatedByAndActiveTrueAndDeletedFalse(userId).orElse(null);
        if (med == null) {
            return "Retatrutid ciklus: " + ToolText.NO_DATA;
        }
        LocalDate today = LocalDate.now();
        MedicationCycle cycle = medicationCycleService.derive(userId, med, today);
        if (cycle.retaDay() == 0) {
            // honest zero — active med but no recorded dose to anchor the cycle
            return "Retatrutid ciklus: " + med.getName() + " — nincs rögzített dózis";
        }
        List<MedicationDoseEntity> doses = medicationDoseRepository
                .findTop10ByCreatedByAndMedicationIdAndDeletedFalseOrderByAdministeredAtDesc(userId, med.getId());
        MedicationDoseEntity last = doses.getFirst();
        StringBuilder b = new StringBuilder("Retatrutid ciklus: ").append(med.getName())
                .append(" — ").append(cycle.retaDay()).append(". nap (").append(cycle.phaseLabel()).append(')')
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
}

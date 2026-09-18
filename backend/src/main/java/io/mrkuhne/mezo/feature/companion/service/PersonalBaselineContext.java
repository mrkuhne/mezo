package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import io.mrkuhne.mezo.feature.biometrics.profile.repository.BiometricProfileRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.companion.tools.ToolText;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Period;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/** Compact stored facts shared by retrieval planning and prose; never an inferred health report. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PersonalBaselineContext {
    private static final String MISSING = "nincs rögzítve";
    private final BiometricProfileRepository profiles;
    private final WeightLogRepository weights;
    private final GoalRepository goals;

    public String render(UUID userId, LocalDate today) {
        StringBuilder text = new StringBuilder("\n[Személyes alapadatok]\n");
        profiles.findByCreatedByAndDeletedFalse(userId).ifPresentOrElse(
                profile -> appendProfile(text, profile, today),
                () -> text.append("Biometrikus profil: ").append(MISSING).append('\n'));
        weights.findFirstByCreatedByAndDeletedFalseOrderByDateDescCreatedAtDesc(userId).ifPresentOrElse(
                weight -> text.append("Legutóbbi testsúlymérés: ").append(number(weight.getWeightKg(), " kg"))
                        .append("; mérés dátuma: ").append(weight.getDate()).append('\n'),
                () -> text.append("Testsúlymérés: ").append(MISSING).append('\n'));
        goals.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(userId, "active").stream()
                .findFirst().ifPresentOrElse(goal -> appendGoal(text, goal, today),
                        () -> text.append("Aktív testsúlycél: nincs\n"));
        return text.toString();
    }

    private static void appendProfile(StringBuilder text, BiometricProfileEntity profile, LocalDate today) {
        text.append("Életkor: ").append(Period.between(profile.getBirthDate(), today).getYears())
                .append(" év; születési dátum: ").append(profile.getBirthDate()).append('\n')
                .append("Magasság: ").append(number(profile.getHeightCm(), " cm"))
                .append("; Nem: ").append(switch (profile.getSex()) {
                    case "M" -> "férfi";
                    case "F" -> "nő";
                    default -> MISSING;
                }).append('\n')
                .append("Rögzített testzsír: ").append(number(profile.getBodyFatPct(), "%"))
                .append("; aktivitási szint: ").append(profile.getActivityLevel() == null
                        ? MISSING : switch (profile.getActivityLevel()) {
                            case "DESK" -> "ülő életmód (DESK)";
                            case "MIXED" -> "vegyes életmód (MIXED)";
                            case "PHYSICAL" -> "fizikai munka (PHYSICAL)";
                            default -> MISSING;
                        }).append('\n');
    }

    private static void appendGoal(StringBuilder text, GoalEntity goal, LocalDate today) {
        text.append("Aktív testsúlycél: ").append(ToolText.huTrajectory(goal.getTrajectory()))
                .append(" (").append(goal.getTrajectory()).append(")\n")
                .append("Kezdősúly: ").append(number(goal.getStartWeightKg(), " kg"))
                .append("; Célsúly: ").append(number(goal.getTargetWeightKg(), " kg")).append('\n')
                .append("Kezdés: ").append(goal.getStartDate())
                .append("; céldátum: ").append(goal.getTargetDate()).append('\n');
        long week = ChronoUnit.DAYS.between(goal.getStartDate(), today) / 7 + 1;
        var segment = today.isBefore(goal.getStartDate()) || today.isAfter(goal.getTargetDate()) ? null
                : GoalPrescriptionJson.currentSegment(goal.getPrescription(), week);
        if (segment == null) {
            text.append("Mai táplálkozási előírás: nincs aktuális tárolt szakasz\n");
            return;
        }
        text.append("Mai szakasz tárolt táplálkozási céljai: ")
                .append(number(segment.kcal(), " kcal"))
                .append("; fehérje: ").append(number(segment.proteinG(), " g"))
                .append("; szénhidrát: ").append(number(segment.carbsG(), " g"))
                .append("; zsír: ").append(number(segment.fatG(), " g"));
        if (segment.trainingDayKcal() != null || segment.restDayKcal() != null) {
            text.append("; edzésnap: ").append(number(segment.trainingDayKcal(), " kcal"))
                    .append("; pihenőnap: ").append(number(segment.restDayKcal(), " kcal"));
        }
        text.append('\n');
    }

    private static String number(Number value, String unit) {
        return value == null ? MISSING
                : (value instanceof BigDecimal decimal ? decimal.toPlainString() : value.toString()) + unit;
    }
}

package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.service.AppNotificationEmitter;
import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.medication.entity.MedicationDoseEntity;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.medication.repository.MedicationDoseRepository;
import io.mrkuhne.mezo.feature.medication.repository.MedicationRepository;
import io.mrkuhne.mezo.feature.medication.service.MedicationCycleService;
import io.mrkuhne.mezo.feature.medication.service.dto.MedicationCycle;
import io.mrkuhne.mezo.feature.intention.repository.DailyIntentionRepository;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.feature.companion.tools.ToolText;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * V2.2 narrative memory generator: composes a deterministic, date-scoped Hungarian digest of one
 * FINISHED day's L0 data (the V0.3 snapshot precedent, but past-tense and for a single past day),
 * then one cheap-tier {@link CompanionLlm} call turns it into a short narrative persisted as
 * {@code daily_summary}. Digest = pure code, narrative = pure LLM (NFR-M-4: never both in one
 * step). A day with zero L0 rows produces NO summary (nothing to remember); an existing summary
 * is returned untouched (idempotent — the LLM is not called again).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class DailySummaryService {

    /** Prompt prefix the fake LLM dispatches on (the EXTRACTION_MARKER precedent). */
    public static final String SUMMARY_MARKER = "NAPI-ÖSSZEFOGLALÓ-FELADAT";

    private static final String NARRATIVE_PROMPT = SUMMARY_MARKER + "\n"
            + "Írj rövid (3-5 mondatos), múlt idejű, magyar összefoglalót {{NÉV}} napjáról az alábbi "
            + "tényadatokból. Csak a megadott adatokra támaszkodj, semmit ne találj ki; a számokat "
            + "őrizd meg pontosan. Egyes szám harmadik személy helyett közvetlen, társ-hangú "
            + "fogalmazás (\"kemény leg-day volt\", nem \"a felhasználó edzett\").";

    private final DailySummaryRepository dailySummaryRepository;
    private final CompanionLlm companionLlm;
    private final CompanionProperties properties;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseSetRepository exerciseSetRepository;
    private final SportSessionRepository sportSessionRepository;
    private final RunSessionLogRepository runSessionLogRepository;
    private final FuelDayService fuelDayService;
    private final SleepLogRepository sleepLogRepository;
    private final WeightLogRepository weightLogRepository;
    private final CheckInRepository checkInRepository;
    private final MedicationRepository medicationRepository;
    private final MedicationDoseRepository medicationDoseRepository;
    private final MedicationCycleService medicationCycleService;
    private final MentionRepository mentionRepository;
    private final DailyIntentionRepository dailyIntentionRepository;
    private final LlmCallContextHolder llmCallContextHolder;
    private final AppNotificationEmitter appNotificationEmitter;
    private final PromptPersona promptPersona;

    /**
     * Generates (or returns the existing) summary for one finished day. Returns null for an
     * empty day. The caller (nightly job) pairs a non-null result with the embed writer —
     * returning the EXISTING row lets a failed embedding self-heal on the next run.
     */
    @Transactional
    public DailySummaryEntity generate(UUID userId, LocalDate date) {
        DailySummaryEntity existing = dailySummaryRepository
                .findByCreatedByAndSummaryDate(userId, date).orElse(null);
        if (existing != null) {
            return existing;
        }
        String digest = digest(userId, date);
        if (digest == null) {
            log.debug("No L0 data for {} on {} — no summary", userId, date);
            return null;
        }
        String narrative = llmCallContextHolder.runWith(
                new LlmCallContext("companion_daily_summary", "narrative", null, null),
                () -> companionLlm.complete(promptPersona.render(userId, NARRATIVE_PROMPT), digest));
        DailySummaryEntity summary = new DailySummaryEntity();
        summary.setCreatedBy(userId);
        summary.setSummaryDate(date);
        summary.setNarrative(narrative);
        DailySummaryEntity saved = dailySummaryRepository.saveAndFlush(summary);
        appNotificationEmitter.emit(userId, AppNotificationKind.MEMORY_NOTE,
                "Napi összefoglaló kész",
                "A(z) " + date + " nap emléke megírva és beágyazva a memóriába.",
                AppNotificationKind.MEMORY_NOTE.deeplink(), saved.getId(),
                "memory_note:" + date);
        return saved;
    }

    /** Deterministic date-scoped digest — one labelled Hungarian line per present L0 block. */
    private String digest(UUID userId, LocalDate date) {
        List<String> blocks = new ArrayList<>();
        addTrain(blocks, userId, date);
        addFuel(blocks, userId, date);
        addSleep(blocks, userId, date);
        addWeight(blocks, userId, date);
        addMedication(blocks, userId, date);
        addCheckIns(blocks, userId, date);
        addMentions(blocks, userId, date);
        addIntention(blocks, userId, date);
        if (blocks.isEmpty()) {
            return null;
        }
        return "Dátum: " + date + "\n" + String.join("\n", blocks);
    }

    private void addTrain(List<String> blocks, UUID userId, LocalDate date) {
        for (WorkoutSessionEntity w : workoutSessionRepository.findDoneInstancesBetween(userId, date, date)) {
            long sets = exerciseSetRepository
                    .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(userId, w.getId()).stream()
                    .filter(s -> !s.isSkipped() && s.getReps() != null)
                    .count();
            blocks.add("Edzés: " + w.getDayLabel() + " (" + sets + " sorozat)");
        }
        sportSessionRepository.findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, date)
                .stream().filter(s -> date.equals(s.getDate()))
                .forEach(s -> blocks.add("Sport: " + s.getSport()
                        + (s.getDurationMin() != null ? ", " + s.getDurationMin() + " perc" : "")
                        + (s.getIntensity() != null ? ", intenzitás " + s.getIntensity() + "/5" : "")));
        runSessionLogRepository.findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, date)
                .stream().filter(r -> date.equals(r.getDate()))
                .forEach(r -> {
                    String notes = cap(r.getNotes());
                    blocks.add("Futás: "
                            + (r.getCompletedRounds() != null ? r.getCompletedRounds() + " kör" : "megvolt")
                            + (r.getRpeActual() != null ? ", RPE " + r.getRpeActual() : "")
                            + (notes.isBlank() ? "" : " — \"" + notes + "\""));
                });
    }

    private void addFuel(List<String> blocks, UUID userId, LocalDate date) {
        FuelDayResponse day = fuelDayService.getDay(userId, date);
        if (day.getMeals().isEmpty()) {
            return;
        }
        String titles = day.getMeals().stream().map(MealResponse::getTitle).limit(3)
                .collect(Collectors.joining(", "));
        blocks.add("Étkezés: " + ToolText.num(day.getConsumed().getKcal()) + "/" + ToolText.num(day.getTargets().getKcal())
                + " kcal, fehérje " + ToolText.num(day.getConsumed().getP()) + "/" + ToolText.num(day.getTargets().getP())
                + " g, " + day.getMeals().size() + " étkezés (" + titles
                + (day.getMeals().size() > 3 ? ", …" : "") + ")");
    }

    private void addSleep(List<String> blocks, UUID userId, LocalDate date) {
        sleepLogRepository.findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, date)
                .stream().filter(s -> date.equals(s.getDate())).findFirst()
                .ifPresent(s -> {
                    String notes = cap(s.getNotes());
                    blocks.add("Alvás: " + ToolText.num(s.getDurationH()) + " óra"
                            + (s.getQuality() != null ? ", minőség " + s.getQuality() + "/5" : "")
                            + (s.getAwakenings() != null && s.getAwakenings() > 0
                                    ? ", " + s.getAwakenings() + " ébredés" : "")
                            + (notes.isBlank() ? "" : " — \"" + notes + "\""));
                });
    }

    private void addWeight(List<String> blocks, UUID userId, LocalDate date) {
        weightLogRepository.findFirstByCreatedByAndDeletedFalseAndDateOrderByCreatedAtDesc(userId, date)
                .ifPresent(w -> blocks.add("Súly: " + ToolText.num(w.getWeightKg()) + " kg"));
    }

    private void addMedication(List<String> blocks, UUID userId, LocalDate date) {
        MedicationEntity med = medicationRepository
                .findFirstByCreatedByAndActiveTrueAndDeletedFalse(userId).orElse(null);
        if (med == null) {
            return;
        }
        MedicationCycle cycle = medicationCycleService.derive(userId, med, date);
        if (cycle.cycleDay() == 0) {
            return; // active med but no dose anchor — nothing day-specific to remember
        }
        MedicationDoseEntity lastOnOrBefore = medicationDoseRepository
                .findFirstByCreatedByAndMedicationIdAndDeletedFalseAndAdministeredDateLessThanEqualOrderByAdministeredDateDesc(
                        userId, med.getId(), date)
                .orElse(null);
        boolean dosedThatDay = lastOnOrBefore != null && date.equals(lastOnOrBefore.getAdministeredDate());
        blocks.add("Gyógyszer: " + med.getName() + " " + cycle.cycleDay() + ". ciklusnap ("
                + cycle.phaseLabel() + ")"
                + (dosedThatDay ? ", dózis beadva: " + ToolText.num(lastOnOrBefore.getDose()) + " " + med.getDoseUnit() : ""));
    }

    private void addCheckIns(List<String> blocks, UUID userId, LocalDate date) {
        for (CheckInEntity c : checkInRepository.findByCreatedByAndDateOrderBySlotTime(userId, date)) {
            String note = cap(c.getNote());
            blocks.add("Check-in" + (c.getSlotTime() != null ? " (" + c.getSlotTime() + ")" : "") + ":"
                    + (c.getEnergy() != null ? " energia " + c.getEnergy() + "/5" : "")
                    + (c.getStress() != null ? ", stressz " + c.getStress() + "/5" : "")
                    + (note.isBlank() ? "" : " — \"" + note + "\""));
        }
    }

    /** People-említések tónussal + capelt kivonattal (V3.4 B1) — a nap legfrissebb 5 említése. */
    private void addMentions(List<String> blocks, UUID userId, LocalDate date) {
        ZoneId zone = ZoneId.systemDefault();
        mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(userId).stream()
                .filter(m -> date.equals(m.getTs().atZone(zone).toLocalDate()))
                .limit(5)
                .forEach(m -> blocks.add("Említés (" + m.getTone() + "): \"" + cap(m.getExcerpt()) + "\""));
    }

    /** Az esti intention-reflexió (V3.4 B1) — kategorikus válasz (yes|partial|no), magyarul. */
    private void addIntention(List<String> blocks, UUID userId, LocalDate date) {
        dailyIntentionRepository.findByCreatedByAndIntentionDateAndDeletedFalse(userId, date)
                .ifPresent(i -> blocks.add("Napi szándék-reflexió: " + switch (i.getReflection()) {
                    case "yes" -> "igen";
                    case "partial" -> "részben";
                    default -> "nem";
                }));
    }

    /** Minőségi mező capelése (V3.4 B1 — summary.note-max-chars); null/üres → üres string. */
    private String cap(String text) {
        if (text == null) {
            return "";
        }
        String trimmed = text.strip();
        int max = properties.summary().noteMaxChars();
        return trimmed.length() > max ? trimmed.substring(0, max) : trimmed;
    }
}

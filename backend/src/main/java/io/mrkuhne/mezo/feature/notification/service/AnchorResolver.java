package io.mrkuhne.mezo.feature.notification.service;

import io.mrkuhne.mezo.api.dto.RitualWindow;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepAnchorPort;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.medication.repository.MedicationRepository;
import io.mrkuhne.mezo.feature.medication.service.MedicationCycleService;
import io.mrkuhne.mezo.feature.medication.service.dto.MedicationCycle;
import io.mrkuhne.mezo.feature.notification.config.NotificationProperties;
import io.mrkuhne.mezo.feature.notification.domain.AnchorSet;
import io.mrkuhne.mezo.feature.notification.domain.AnchorSet.AnchoredEvent;
import io.mrkuhne.mezo.feature.notification.domain.NotificationCategory;
import io.mrkuhne.mezo.feature.notification.domain.ScheduleEntry;
import io.mrkuhne.mezo.feature.proactive.entity.HeartbeatNoteEntity;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklySuggestionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.BriefingRepository;
import io.mrkuhne.mezo.feature.proactive.repository.HeartbeatNoteRepository;
import io.mrkuhne.mezo.feature.proactive.repository.MemoirRepository;
import io.mrkuhne.mezo.feature.proactive.repository.WeeklySuggestionRepository;
import io.mrkuhne.mezo.feature.ritual.service.RitualService;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.SportScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The impure half of the dispatcher (bd mezo-h4wp.6.2): reads every one of the 11 categories'
 * anchors for one owner+day into an {@link AnchorSet}, the pure {@link DueEvaluator}'s input.
 * A wrong read here produces a notification at the wrong minute or, worse, a per-minute write
 * storm — see the class-by-class notes below, each pinned to a verified trap.
 *
 * <p><b>Weekday numbering — two schemes, converted explicitly, never "harmonised":</b>
 * {@code gym_schedule_slot.dayOfWeek} / {@code sport_schedule_slot.dayOfWeek} are legacy
 * <b>0=Mon..6=Sun</b>, compared against {@code date.getDayOfWeek().getValue() - 1}; the FE-written
 * {@code notification_schedule.weekday} is <b>ISO 1=Mon..7=Sun</b>, compared directly against
 * {@code date.getDayOfWeek().getValue()}.
 *
 * <p><b>Never calls {@code WorkoutService.getToday(...)}</b> — it hardcodes {@code LocalDate.now()}
 * and triggers three nested {@code @Transactional} <b>writes</b> (autoClose/rollover/closing
 * exercises); a per-minute cron doing that per user would be a write storm. This class only calls
 * the pure read {@link WorkoutService#findPlannedTemplateForDate(UUID, LocalDate)}.
 *
 * <p><b>{@code RitualService} is optional</b> ({@link ObjectProvider}): the whole bean disappears
 * when {@code mezo.feature.ritual.enabled=false}, and when it is absent this resolver yields no
 * {@code ritual}/{@code wind_down}/{@code lights_out} anchor for the day — never a fabricated
 * window.
 *
 * <p><b>Wake/bed anchor</b> comes only from {@link SleepAnchorPort#resolve(UUID)}, which never
 * returns empty (it falls back to config when no {@code sleep_goal} row exists) — the retired
 * {@code goal.wake_time}/{@code goal.bed_time} columns are never read.
 *
 * <p><b>{@code medication}'s {@code retaDay == 0}</b> is {@link MedicationCycleService}'s honest
 * "no dose logged yet" state and is treated as "no anchor today", never as cycle day zero.
 *
 * <p>Prose anchors ({@code briefing}, {@code midday}, {@code weekly}, {@code memoir}) exist only
 * when their content row exists for the day — a missing row is an honest absence, never a
 * placeholder. Their body is an excerpt of the already-generated text (never a new LLM call),
 * cut at a word boundary via {@link #excerptProse(String)}, which reuses {@link
 * PushSender#truncateBody(String, int)}'s surrogate-safe cut (same package) rather than a second
 * raw {@code substring}.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.NOTIFICATION_SWITCH, havingValue = "true")
public class AnchorResolver {

    private static final String URL_TODAY = "/today";
    private static final String URL_TRAIN_SESSION = "/train/session";
    private static final String URL_TRAIN_SPORT = "/train/sport";
    private static final String URL_MEDICATION = "/fuel/gyogyszer";
    private static final String URL_RITUAL = "/ritual";
    private static final String URL_LIGHTS_OUT = "/me/sleep";
    private static final String URL_INSIGHTS_WEEKLY = "/insights/weekly";
    private static final String URL_INSIGHTS_MEMOIR = "/insights/memoir";

    private static final int MIDDAY_MINUTE = 12 * 60 + 30;
    private static final String MIDDAY_HHMM = "12:30";
    private static final LocalTime MEMOIR_TIME = LocalTime.of(19, 0);
    private static final String MEMOIR_HHMM = "19:00";

    private final GymScheduleSlotRepository gymScheduleSlotRepository;
    private final SportScheduleSlotRepository sportScheduleSlotRepository;
    private final WorkoutService workoutService;
    private final SleepAnchorPort sleepAnchorPort;
    private final ObjectProvider<RitualService> ritualServiceProvider;
    private final MedicationRepository medicationRepository;
    private final MedicationCycleService medicationCycleService;
    private final BriefingRepository briefingRepository;
    private final HeartbeatNoteRepository heartbeatNoteRepository;
    private final WeeklySuggestionRepository weeklySuggestionRepository;
    private final MemoirRepository memoirRepository;
    private final NotificationScheduleService notificationScheduleService;
    private final NotificationProperties notificationProperties;

    @Transactional(readOnly = true)
    public AnchorSet resolve(UUID owner, LocalDate date) {
        List<AnchoredEvent> backendAnchors = new ArrayList<>(gymAnchors(owner, date));
        medicationAnchor(owner, date).ifPresent(backendAnchors::add);
        ritualFamilyAnchors(owner, date, backendAnchors);

        List<AnchoredEvent> proseAnchors = new ArrayList<>();
        briefingAnchor(owner, date).ifPresent(proseAnchors::add);
        middayAnchor(owner, date).ifPresent(proseAnchors::add);
        weeklyAnchor(owner, date).ifPresent(proseAnchors::add);
        memoirAnchor(owner, date).ifPresent(proseAnchors::add);

        List<AnchoredEvent> scheduleAnchors = scheduleAnchors(owner, date);

        return new AnchorSet(backendAnchors, proseAnchors, scheduleAnchors);
    }

    // ---- gym (gym_schedule_slot + sport_schedule_slot) ----------------------------------------

    private List<AnchoredEvent> gymAnchors(UUID owner, LocalDate date) {
        // Trap #1: gym_schedule_slot/sport_schedule_slot.dayOfWeek is legacy 0=Mon..6=Sun —
        // convert date's ISO 1=Mon..7=Sun explicitly; do NOT compare getValue() directly here.
        int legacyDayOfWeek = date.getDayOfWeek().getValue() - 1;

        // Trap #2: findPlannedTemplateForDate, never getToday() (that one writes on every call).
        Optional<WorkoutSessionEntity> plannedTemplate = workoutService.findPlannedTemplateForDate(owner, date);

        List<AnchoredEvent> events = new ArrayList<>();
        for (GymScheduleSlotEntity slot : gymScheduleSlotRepository
                .findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(owner)) {
            if (slot.getDayOfWeek() == legacyDayOfWeek) {
                events.add(gymSlotEvent(slot.getTime(), plannedTemplate));
            }
        }
        for (SportScheduleSlotEntity slot : sportScheduleSlotRepository
                .findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(owner)) {
            if (slot.getDayOfWeek() == legacyDayOfWeek) {
                events.add(sportSlotEvent(slot));
            }
        }
        return events;
    }

    private static AnchoredEvent gymSlotEvent(String time, Optional<WorkoutSessionEntity> plannedTemplate) {
        String title = plannedTemplate.map(AnchorResolver::gymTitle).orElse("Edzés");
        String body = time + "-kor kezdjük.";
        return new AnchoredEvent(NotificationCategory.GYM, minuteOfDay(time), time, title, body, URL_TRAIN_SESSION);
    }

    /** "{durationEst} perc: {dayLabel}" (mockup style) — falls back to just the day label when
     *  the template carries no duration estimate, never a fabricated number. */
    private static String gymTitle(WorkoutSessionEntity session) {
        Integer duration = session.getDurationEst();
        return duration == null ? session.getDayLabel() : duration + " perc: " + session.getDayLabel();
    }

    private static AnchoredEvent sportSlotEvent(SportScheduleSlotEntity slot) {
        String title = sportTitle(slot.getSport(), slot.getKind());
        String location = slot.getLocation();
        String body = slot.getTime() + "-kor kezdjük"
                + (location == null || location.isBlank() ? "" : " · " + location) + ".";
        return new AnchoredEvent(NotificationCategory.GYM, minuteOfDay(slot.getTime()), slot.getTime(),
                title, body, URL_TRAIN_SPORT);
    }

    private static String sportTitle(String sport, String kind) {
        String sportHu = switch (sport) {
            case "volleyball" -> "Röplabda";
            case "cross" -> "Cross";
            case "trx" -> "TRX";
            default -> sport;
        };
        String kindHu = "match".equals(kind) ? "meccs" : "edzés";
        return sportHu + " " + kindHu;
    }

    // ---- medication -----------------------------------------------------------------------------

    private Optional<AnchoredEvent> medicationAnchor(UUID owner, LocalDate date) {
        Optional<MedicationEntity> medication =
                medicationRepository.findFirstByCreatedByAndActiveTrueAndDeletedFalse(owner);
        if (medication.isEmpty()) {
            return Optional.empty();
        }
        MedicationEntity med = medication.get();
        MedicationCycle cycle = medicationCycleService.derive(owner, med, date);
        if (cycle.retaDay() == 0) {
            // Trap #5: retaDay == 0 is the honest "no dose logged yet" state — not a dose day.
            return Optional.empty();
        }
        String time = notificationProperties.medicationTime();
        String title = med.getName() + " emlékeztető";
        String body = "A ciklus " + cycle.retaDay() + ". napja"
                + (cycle.phaseLabel() == null ? "" : " — " + cycle.phaseLabel()) + "."
                + doseSuffix(med);
        return Optional.of(new AnchoredEvent(NotificationCategory.MEDICATION, minuteOfDay(time), time,
                title, body, URL_MEDICATION));
    }

    /** Reference-only dose info (never an instruction to take it now — the clinical guard the
     *  medication push inherits, spec §6). Omitted when the catalog row carries no dose/unit. */
    private static String doseSuffix(MedicationEntity med) {
        if (med.getDefaultDose() == null || med.getDoseUnit() == null) {
            return "";
        }
        return " " + med.getDefaultDose().stripTrailingZeros().toPlainString() + " " + med.getDoseUnit() + ".";
    }

    // ---- ritual / lights_out / wind_down ---------------------------------------------------------

    private void ritualFamilyAnchors(UUID owner, LocalDate date, List<AnchoredEvent> target) {
        // Trap #3: the whole RitualService bean disappears when RITUAL_SWITCH is off.
        RitualService ritualService = ritualServiceProvider.getIfAvailable();
        if (ritualService == null) {
            return;
        }
        RitualWindow window = ritualService.getDay(owner, date).getWindow();
        String opensAt = window.getOpensAt();
        String prepStartsAt = window.getPrepStartsAt();
        String bedTime = window.getBedTime();

        target.add(new AnchoredEvent(NotificationCategory.RITUAL, minuteOfDay(opensAt), opensAt,
                "Zárjuk le a napot ✨", "Nézzük meg együtt, mi történt ma.", URL_RITUAL));

        target.add(new AnchoredEvent(NotificationCategory.LIGHTS_OUT, minuteOfDay(bedTime), bedTime,
                "Villanyoltás · " + bedTime, "Most. A holnapi reggeled itt kezdődik.", URL_LIGHTS_OUT));

        // The gap is a real, derivable number (bed - prepStartsAt), never an invented "one hour".
        long prepMinutes = Duration.between(LocalTime.parse(prepStartsAt), LocalTime.parse(bedTime)).toMinutes();
        target.add(new AnchoredEvent(NotificationCategory.WIND_DOWN, minuteOfDay(prepStartsAt), prepStartsAt,
                "Lecsendesítés", prepMinutes + " perc a villanyoltásig. Képernyő le, magnézium.", URL_TODAY));
    }

    // ---- prose anchors: briefing / midday / weekly / memoir --------------------------------------

    private Optional<AnchoredEvent> briefingAnchor(UUID owner, LocalDate date) {
        return briefingRepository.findByCreatedByAndBriefingDate(owner, date).map(briefing -> {
            LocalTime wake = sleepAnchorPort.resolve(owner).wake();
            String wakeHhmm = hhmm(wake);
            String body = excerptProse(String.join(" ", briefing.getContent().body()));
            return new AnchoredEvent(NotificationCategory.BRIEFING, minuteOfDay(wake), wakeHhmm,
                    "Mezo · reggeli briefing", body, URL_TODAY);
        });
    }

    private Optional<AnchoredEvent> middayAnchor(UUID owner, LocalDate date) {
        return heartbeatNoteRepository
                .findByCreatedByAndNoteDateAndWindowKey(owner, date, HeartbeatNoteEntity.WINDOW_MIDDAY)
                .map(note -> new AnchoredEvent(NotificationCategory.MIDDAY, MIDDAY_MINUTE, MIDDAY_HHMM,
                        "Mezo", excerptProse(note.getContent()), URL_TODAY));
    }

    private Optional<AnchoredEvent> weeklyAnchor(UUID owner, LocalDate date) {
        if (date.getDayOfWeek() != DayOfWeek.MONDAY) {
            return Optional.empty();
        }
        return weeklySuggestionRepository.findByCreatedByAndWeekStart(owner, date).map(suggestion -> {
            LocalTime wake = sleepAnchorPort.resolve(owner).wake();
            String wakeHhmm = hhmm(wake);
            return new AnchoredEvent(NotificationCategory.WEEKLY, minuteOfDay(wake), wakeHhmm,
                    "Mezo · heti terv", excerptProse(suggestion.getProse()), URL_INSIGHTS_WEEKLY);
        });
    }

    private Optional<AnchoredEvent> memoirAnchor(UUID owner, LocalDate date) {
        if (date.getDayOfWeek() != DayOfWeek.SUNDAY) {
            return Optional.empty();
        }
        LocalDate weekStart = date.minusDays(date.getDayOfWeek().getValue() - 1L); // this week's ISO Monday
        return memoirRepository.findByCreatedByAndWeekStart(owner, weekStart)
                .map(memoir -> new AnchoredEvent(NotificationCategory.MEMOIR, minuteOfDay(MEMOIR_TIME), MEMOIR_HHMM,
                        "Mezo · a heted története", excerptProse(memoir.getBody()), URL_INSIGHTS_MEMOIR));
    }

    private String excerptProse(String text) {
        return excerptProse(text, notificationProperties.proseExcerptChars());
    }

    /** Excerpts already-generated prose to {@code maxChars}, cut at a word boundary. Reuses
     *  {@link PushSender#truncateBody(String, int)}'s surrogate-safe cut (same package) rather
     *  than a second raw {@code substring} — a lone surrogate turns into "?" on the wire.
     *
     *  <p>Package-private (not private) and takes {@code maxChars} explicitly, rather than
     *  reading {@code notificationProperties} itself, so {@code AnchorResolverExcerptTest} can
     *  exercise the word-boundary + surrogate-safety contract as a plain unit test — no Spring
     *  context or 12-collaborator constructor needed for what is otherwise a pure function. */
    static String excerptProse(String text, int maxChars) {
        if (text == null) {
            return null;
        }
        String surrogateSafe = PushSender.truncateBody(text, maxChars);
        if (surrogateSafe == null || surrogateSafe.length() == text.length()) {
            return surrogateSafe; // untouched — already within the limit
        }
        int lastSpace = surrogateSafe.lastIndexOf(' ');
        return lastSpace > 0 ? surrogateSafe.substring(0, lastSpace) : surrogateSafe;
    }

    // ---- FE-written schedule: checkin / fuel_slot ------------------------------------------------

    private List<AnchoredEvent> scheduleAnchors(UUID owner, LocalDate date) {
        // notification_schedule.weekday is ISO 1=Mon..7=Sun — compared DIRECTLY, unlike the
        // legacy 0-based gym/sport slots above (trap #1's other half).
        int isoWeekday = date.getDayOfWeek().getValue();
        List<AnchoredEvent> events = new ArrayList<>();
        for (ScheduleEntry entry : notificationScheduleService.liveFor(owner)) {
            if (entry.weekday() != null && entry.weekday() != isoWeekday) {
                continue;
            }
            NotificationCategory category = NotificationCategory.fromKey(entry.category()).orElse(null);
            if (category == null) {
                continue; // an unrecognised category must never abort resolution for the rest
            }
            events.add(new AnchoredEvent(category, minuteOfDay(entry.time()), entry.time(),
                    entry.title(), entry.body() == null ? "" : entry.body(), entry.deeplink()));
        }
        return events;
    }

    // ---- time helpers -----------------------------------------------------------------------------

    private static int minuteOfDay(String hhmm) {
        return minuteOfDay(LocalTime.parse(hhmm));
    }

    private static int minuteOfDay(LocalTime time) {
        return time.getHour() * 60 + time.getMinute();
    }

    private static String hhmm(LocalTime time) {
        return String.format("%02d:%02d", time.getHour(), time.getMinute());
    }
}

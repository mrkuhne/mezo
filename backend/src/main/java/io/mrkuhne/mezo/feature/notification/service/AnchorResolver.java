package io.mrkuhne.mezo.feature.notification.service;

import io.mrkuhne.mezo.api.dto.RitualWindow;
import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.entity.AppNotificationEntity;
import io.mrkuhne.mezo.feature.appnotification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepAnchorPort;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.medication.repository.MedicationRepository;
import io.mrkuhne.mezo.feature.medication.service.MedicationCycleService;
import io.mrkuhne.mezo.feature.medication.service.dto.MedicationCycle;
import io.mrkuhne.mezo.feature.notification.config.NotificationProperties;
import io.mrkuhne.mezo.feature.notification.domain.AnchorSet;
import io.mrkuhne.mezo.feature.notification.domain.AnchorSet.AnchoredEvent;
import io.mrkuhne.mezo.feature.notification.domain.NotificationCategory;
import io.mrkuhne.mezo.feature.notification.domain.ScheduleEntry;
import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.feature.proactive.repository.MemoirRepository;
import io.mrkuhne.mezo.feature.proactive.repository.WeeklyReviewRepository;
import io.mrkuhne.mezo.feature.ritual.service.RitualService;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.SportScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.service.SportSlotSkipService;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.UUID;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The impure half of the dispatcher (bd mezo-h4wp.6.2, mezo-gst9): reads every one of the 22 categories'
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
 * <p><b>{@code medication}'s {@code cycleDay == 0}</b> is {@link MedicationCycleService}'s honest
 * "no dose logged yet" state and is treated as "no anchor today", never as cycle day zero.
 *
 * <p>Prose anchors ({@code briefing}/{@code morning}, {@code midday}, {@code evening},
 * {@code sleep_reaction}, {@code weight_reaction}, {@code weekly_review}, {@code memoir}) exist
 * only when their content row exists for the day — a missing row is an honest absence, never a
 * placeholder. Five of the seven ({@code morning}/{@code midday}/{@code evening}/
 * {@code sleep_reaction}/{@code weight_reaction}) read the unified {@code companion_message}
 * table (companion-feed, mezo-gst9) instead of the retired {@code briefing}/{@code
 * heartbeat_note} tables; {@code weekly_review}/{@code memoir} are unaffected. Their body is an excerpt
 * of the already-generated text (never a new LLM call), cut at a word boundary via {@link
 * #excerptProse(String)}, which reuses {@link PushSender#truncateBody(String, int)}'s
 * surrogate-safe cut (same package) rather than a second raw {@code substring}.
 *
 * <p><b>Trap #6 — a prose anchor must never land on its own generator's minute</b>
 * (see {@link #anchorAfterGeneration}): every prose anchor goes through that method, which pushes
 * it past the generator's cron minute by {@code mezo.notification.prose-generation-grace-min}.
 */
@Slf4j
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
    private static final String URL_INSIGHTS_MEMOIR = "/insights/memoir";
    private static final String URL_JOURNAL = "/me/naplo";
    /** The companion thread page — where the feed cards and their „Segített?" chips actually
     *  render (`NapMezoPage`). NOT `/today`: that is a legacy path the router redirects to the
     *  Nap HUB, which does not render the thread, so the push landed a page away from its card
     *  (mezo-b3pp.36). */
    private static final String URL_THREAD = "/nap/uzenetek";

    /** The intended (pre-grace) in-day slots for the two constant-anchored prose categories. Both
     *  go through {@link #anchorAfterGeneration}, so the minute actually used is derived from the
     *  generator cron + the grace — these are the "not earlier than" preference, not the answer. */
    private static final int MIDDAY_PREFERRED_MINUTE = 12 * 60 + 30;
    private static final int EVENING_PREFERRED_MINUTE = 20 * 60 + 30;
    private static final int MEMOIR_PREFERRED_MINUTE = 19 * 60;

    /** Fixed Monday 10:00 push slot for the weekly review (mezo-p2tr) — unlike the retired
     *  {@code weekly} push, this never collides with its generator's 06:50 cron, so it needs no
     *  {@link #anchorAfterGeneration} grace. */
    private static final int WEEKLY_REVIEW_MINUTE = 10 * 60;

    private static final int LAST_MINUTE_OF_DAY = 23 * 60 + 59;

    private final GymScheduleSlotRepository gymScheduleSlotRepository;
    private final SportScheduleSlotRepository sportScheduleSlotRepository;
    private final SportSlotSkipService sportSlotSkipService;
    private final WorkoutService workoutService;
    private final SleepAnchorPort sleepAnchorPort;
    private final ObjectProvider<RitualService> ritualServiceProvider;
    private final MedicationRepository medicationRepository;
    private final MedicationCycleService medicationCycleService;
    private final CompanionMessageRepository companionMessageRepository;
    private final WeeklyReviewRepository weeklyReviewRepository;
    private final MemoirRepository memoirRepository;
    private final NotificationScheduleService notificationScheduleService;
    private final NotificationProperties notificationProperties;
    private final ProactiveProperties proactiveProperties;
    private final AppNotificationRepository appNotificationRepository;
    private final DecisionEntryRepository decisionEntryRepository;
    private final CompanionProperties companionProperties;

    @Transactional(readOnly = true)
    public AnchorSet resolve(UUID owner, LocalDate date) {
        List<AnchoredEvent> backendAnchors = new ArrayList<>(gymAnchors(owner, date));
        medicationAnchor(owner, date).ifPresent(backendAnchors::add);
        ritualFamilyAnchors(owner, date, backendAnchors);
        backendAnchors.addAll(decisionReviewAnchors(owner, date));
        backendAnchors.addAll(interventionAnchors(owner, date));
        backendAnchors.addAll(feedAnchors(owner, date));

        List<AnchoredEvent> proseAnchors = new ArrayList<>();
        morningAnchor(owner, date).ifPresent(proseAnchors::add);
        middayAnchor(owner, date).ifPresent(proseAnchors::add);
        eveningAnchor(owner, date).ifPresent(proseAnchors::add);
        sleepReactionAnchor(owner, date).ifPresent(proseAnchors::add);
        weightReactionAnchor(owner, date).ifPresent(proseAnchors::add);
        weeklyReviewAnchor(owner, date).ifPresent(proseAnchors::add);
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
            if (slot.getDayOfWeek() == legacyDayOfWeek
                    && !sportSlotSkipService.isSkipped(owner, legacyDayOfWeek, slot.getTime(), date)) {
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
        if (cycle.cycleDay() == 0) {
            // Trap #5: cycleDay == 0 is the honest "no dose logged yet" state — not a dose day.
            return Optional.empty();
        }
        String time = notificationProperties.medicationTime();
        String title = med.getName() + " emlékeztető";
        String body = "A ciklus " + cycle.cycleDay() + ". napja"
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

    // ---- decision_review (decision_entry.review_due, W1.4) --------------------------------------

    /**
     * One anchor per decision whose {@code review_due} is EXACTLY {@code date} and that is still
     * unreviewed. Deliberately not {@code review_due <= date}: an overdue decision is carried by
     * the /me/naplo chip, never by a push that would then re-fire every morning forever.
     *
     * <p>The dedup suffix carries the decision's id fragment (the feed-anchor shape) because two
     * decisions can fall due on the same day at the same fixed minute — a bare {@code HH:mm} would
     * collapse them into a single push through {@code push_log}'s day-scoped dedup.
     */
    private List<AnchoredEvent> decisionReviewAnchors(UUID owner, LocalDate date) {
        String time = notificationProperties.decisionReviewTime();
        return decisionEntryRepository
                .findByCreatedByAndReviewDueAndReviewedAtIsNullAndDeletedFalse(owner, date)
                .stream()
                .map(decision -> new AnchoredEvent(NotificationCategory.DECISION_REVIEW,
                        minuteOfDay(time), time + ":" + decision.getId().toString().substring(0, 8),
                        "Hogyan sült el?", excerptProse(decision.getDecisionText()), URL_JOURNAL))
                .toList();
    }

    // ---- intervention (companion_message kind=advice|intervention, W5.2 bd mezo-b3pp.19,
    // widened S4 bd mezo-d58h.4) --------------------------------------------------------------

    /**
     * The card's own generation minute is the anchor (the sleep_reaction rule), except that a
     * non-exempt card generated in quiet hours is DEFERRED to quiet-hours end — possibly onto the
     * next day, which is why yesterday's card is consulted too. Channel gate: a library entry
     * with {@code channel=feed} (or a key no longer in the library — honest absence) yields no
     * push anchor at all. Dedup carries the row id fragment (the feed-anchor shape, unaffected by
     * the url below) so two different intervention cards firing in the same clock minute keep
     * distinct {@code push_log} dedup keys — a bare {@code HH:mm} would collapse them. (Not a
     * push-sw.js tag concern: since mezo-b3pp.36 each card's url is per-card unique, so two
     * intervention pushes no longer share a notification tag anyway.) The url itself points at the companion thread
     * page ({@code URL_THREAD}, not the legacy /today path) with the card's FULL id (so the page
     * can match it exactly) and its own {@code messageDate} (so a card deferred across midnight
     * still names the day whose feed actually holds it — mezo-b3pp.36).
     */
    private List<AnchoredEvent> interventionAnchors(UUID owner, LocalDate date) {
        LocalTime quietStart = LocalTime.parse(notificationProperties.quietHours().start());
        LocalTime quietEnd = LocalTime.parse(notificationProperties.quietHours().end());
        List<AnchoredEvent> events = new ArrayList<>();
        for (LocalDate cardDate : List.of(date.minusDays(1), date)) {
            // S4 (mezo-d58h.4): the coaching card's kind is `advice`; `intervention` rows are
            // pre-S4 history. Both are read so a deploy day does not silently lose a push.
            Stream.of(CompanionMessageEntity.KIND_ADVICE, CompanionMessageEntity.KIND_INTERVENTION)
                .map(kind -> companionMessageRepository
                    .findByCreatedByAndMessageDateAndKind(owner, cardDate, kind))
                .flatMap(Optional::stream)
                .findFirst()
                .ifPresent(msg -> {
                    String key = msg.getContent().interventionKey();
                    Optional<CompanionProperties.Intervention> entry = companionProperties.interventions()
                        .stream().filter(e -> e.key().equals(key)).findFirst();
                    if (entry.isEmpty() || "feed".equals(entry.get().channel())) {
                        return; // feed-only entry or retired key — no push, ever
                    }
                    LocalDateTime generatedAt =
                        LocalDateTime.ofInstant(msg.getGeneratedAt(), ZoneId.systemDefault());
                    interventionFireMinute(generatedAt, date, entry.get().quietHoursExempt(),
                            quietStart, quietEnd)
                        .ifPresent(minute -> {
                            String idFragment = msg.getId().toString().substring(0, 8);
                            // The FULL id goes in the URL so the thread page can match a card
                            // exactly; the 8-char fragment stays the dedup key, because that key
                            // backs push_log's day-scoped dedup and changing its shape could
                            // re-send a push already delivered (mezo-b3pp.36).
                            // `d` is the CARD's own day (messageDate — "the day this message is
                            // FOR", not when it was generated), never the loop's `date`/target
                            // day: a card generated inside quiet hours pushes the next morning,
                            // and only its generation day's feed holds it (mezo-b3pp.36).
                            // Deliberately mirrors InterventionService.EYEBROW as a literal — kept
                            // literal to avoid a service-layer import into this notification-layer
                            // resolver for a display string alone.
                            events.add(new AnchoredEvent(NotificationCategory.INTERVENTION, minute,
                                hhmm(minute) + ":" + idFragment, "Mezo · észrevétel",
                                excerptProse(String.join(" ", msg.getContent().body())),
                                URL_THREAD + "?n=" + msg.getId() + "&d=" + msg.getMessageDate()));
                        });
                });
        }
        return events;
    }

    /**
     * When (if at all) an intervention card generated at {@code generatedAt} pushes on
     * {@code targetDate} (W5.2, bd mezo-b3pp.19). Non-exempt fires inside the quiet window are
     * deferred to the window's END — a 23:10 card lands at next-day 07:00, which is exactly why
     * this is computed per target date instead of assuming same-day: the resolver asks for
     * yesterday's cards too. Returns empty when the (deferred) fire lands on a different date.
     */
    static OptionalInt interventionFireMinute(LocalDateTime generatedAt, LocalDate targetDate,
            boolean quietHoursExempt, LocalTime quietStart, LocalTime quietEnd) {
        LocalDateTime fire = generatedAt;
        if (!quietHoursExempt && !quietStart.equals(quietEnd)) {
            LocalTime t = generatedAt.toLocalTime();
            boolean wraps = quietStart.isAfter(quietEnd);
            boolean quiet = wraps ? !t.isBefore(quietStart) || t.isBefore(quietEnd)
                                  : !t.isBefore(quietStart) && t.isBefore(quietEnd);
            if (quiet) {
                // defer to the NEXT quiet-end at or after the generation moment
                LocalDate endDay = (wraps && !t.isBefore(quietStart))
                        ? generatedAt.toLocalDate().plusDays(1) : generatedAt.toLocalDate();
                fire = endDay.atTime(quietEnd);
            }
        }
        if (!fire.toLocalDate().equals(targetDate)) {
            return OptionalInt.empty();
        }
        return OptionalInt.of(fire.getHour() * 60 + fire.getMinute());
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

    // ---- in-app feed events → push anchors (bd mezo-gzhp.3, spec 2026-08-18 §4) -------------

    /**
     * Today's {@code app_notification} rows, each anchored on max(its own minute, the wake
     * minute): the pattern motor runs 02:20-03:00 and a phone must not ring at night — overnight
     * events ride the wake anchor (the briefing precedent), daytime events their own minute.
     * The dedup suffix carries the row id — the inherited {@code {category}:{HHmm}} form would
     * collapse same-family wake-deferred events into one push, and every event must push
     * (user decision, spec §1). The url carries an {@code ?n=} discriminator because
     * {@code push-sw.js} uses it as the notification tag — two same-deeplink pushes would
     * replace each other on the phone (the check-in bug class).
     */
    private List<AnchoredEvent> feedAnchors(UUID owner, LocalDate date) {
        ZoneId zone = ZoneId.systemDefault();
        Instant from = date.atStartOfDay(zone).toInstant();
        Instant to = date.plusDays(1).atStartOfDay(zone).toInstant();
        int wakeMinute = minuteOfDay(sleepAnchorPort.resolve(owner).wake());

        List<AnchoredEvent> events = new ArrayList<>();
        for (AppNotificationEntity row : appNotificationRepository
                .findByCreatedByAndOccurredAtBetweenAndDeletedFalse(owner, from, to)) {
            Optional<AppNotificationKind> kind = AppNotificationKind.fromKey(row.getKind());
            if (kind.isEmpty() || kind.get().familyKey() == null) {
                continue; // unknown (forward-compat) or memoir_ready (the memoir category owns it)
            }
            Optional<NotificationCategory> category = NotificationCategory.fromKey(kind.get().familyKey());
            if (category.isEmpty()) {
                continue;
            }
            LocalTime eventTime = LocalTime.ofInstant(row.getOccurredAt(), zone);
            int minute = Math.max(eventTime.getHour() * 60 + eventTime.getMinute(), wakeMinute);
            String idFragment = row.getId().toString().substring(0, 8);
            String hhmm = "%02d:%02d".formatted(minute / 60, minute % 60);
            String url = row.getDeeplink() + (row.getDeeplink().contains("?") ? "&" : "?") + "n=" + idFragment;
            events.add(new AnchoredEvent(category.get(), minute, hhmm + ":" + idFragment,
                    row.getTitle(), row.getBody(), url));
        }
        return events;
    }

    // ---- prose anchors: morning / midday / evening / sleep_reaction / weight_reaction / weekly_review / memoir ----
    // The first five read the unified companion_message table (companion-feed, mezo-gst9),
    // replacing the retired briefing/heartbeat_note reads those tables die in a later task.

    private Optional<AnchoredEvent> morningAnchor(UUID owner, LocalDate date) {
        return companionMessageRepository
                .findByCreatedByAndMessageDateAndKind(owner, date, CompanionMessageEntity.KIND_MORNING)
                .map(msg -> {
                    // No-op in practice (generates 05:45, anchors at wake ~06:00) — morning IS the
                    // safe pattern the other prose anchors copy. Routed through the same guard
                    // anyway so a future change to feed.morningCron can never silently starve it.
                    int minute = anchorAfterGeneration(minuteOfDay(sleepAnchorPort.resolve(owner).wake()),
                            proactiveProperties.feed().morningCron(), date);
                    String body = excerptProse(String.join(" ", msg.getContent().body()));
                    return new AnchoredEvent(NotificationCategory.BRIEFING, minute, hhmm(minute),
                            "Mezo · reggeli eligazítás", body, URL_TODAY);
                });
    }

    private Optional<AnchoredEvent> middayAnchor(UUID owner, LocalDate date) {
        return companionMessageRepository
                .findByCreatedByAndMessageDateAndKind(owner, date, CompanionMessageEntity.KIND_MIDDAY)
                .map(msg -> {
                    int minute = anchorAfterGeneration(MIDDAY_PREFERRED_MINUTE,
                            proactiveProperties.feed().middayCron(), date);
                    String body = excerptProse(String.join(" ", msg.getContent().body()));
                    return new AnchoredEvent(NotificationCategory.MIDDAY, minute, hhmm(minute),
                            "Mezo", body, URL_TODAY);
                });
    }

    private Optional<AnchoredEvent> eveningAnchor(UUID owner, LocalDate date) {
        return companionMessageRepository
                .findByCreatedByAndMessageDateAndKind(owner, date, CompanionMessageEntity.KIND_EVENING)
                .map(msg -> {
                    int minute = anchorAfterGeneration(EVENING_PREFERRED_MINUTE,
                            proactiveProperties.feed().eveningCron(), date);
                    String body = excerptProse(String.join(" ", msg.getContent().body()));
                    return new AnchoredEvent(NotificationCategory.EVENING, minute, hhmm(minute),
                            "Mezo · napzárás", body, URL_TODAY);
                });
    }

    /** Unlike the cron-anchored categories above, an event-kind message has no fixed daily
     *  slot — it fires off a user action (a sleep/weight log), so its own generation minute IS
     *  the honest anchor, never a preferred constant pushed past a generator cron. */
    private Optional<AnchoredEvent> sleepReactionAnchor(UUID owner, LocalDate date) {
        return companionMessageRepository
                .findByCreatedByAndMessageDateAndKind(owner, date, CompanionMessageEntity.KIND_SLEEP)
                .map(msg -> {
                    int minute = minuteOfDay(
                            LocalDateTime.ofInstant(msg.getGeneratedAt(), ZoneId.systemDefault()).toLocalTime());
                    String body = excerptProse(String.join(" ", msg.getContent().body()));
                    return new AnchoredEvent(NotificationCategory.SLEEP_REACTION, minute, hhmm(minute),
                            "Mezo · alvás", body, URL_TODAY);
                });
    }

    /** Same event-kind rule as {@link #sleepReactionAnchor} — the row's own generation minute
     *  is the anchor. */
    private Optional<AnchoredEvent> weightReactionAnchor(UUID owner, LocalDate date) {
        return companionMessageRepository
                .findByCreatedByAndMessageDateAndKind(owner, date, CompanionMessageEntity.KIND_WEIGHT)
                .map(msg -> {
                    int minute = minuteOfDay(
                            LocalDateTime.ofInstant(msg.getGeneratedAt(), ZoneId.systemDefault()).toLocalTime());
                    String body = excerptProse(String.join(" ", msg.getContent().body()));
                    return new AnchoredEvent(NotificationCategory.WEIGHT_REACTION, minute, hhmm(minute),
                            "Mezo · testsúly", body, URL_TODAY);
                });
    }

    /**
     * Monday-only, fixed 10:00 push for the JUST-FINISHED week's review (mezo-p2tr) — the
     * backward-looking replacement for the retired {@code weekly} anchor above. The
     * {@code weekly_review} row is keyed by the finished week's own Monday, i.e.
     * {@code date.minusWeeks(1)} when {@code date} IS the resolving Monday (the job runs 06:50 that
     * same morning) — never {@code date} itself, which would look up the CURRENT (not-yet-lived)
     * week and always miss.
     */
    private Optional<AnchoredEvent> weeklyReviewAnchor(UUID owner, LocalDate date) {
        if (date.getDayOfWeek() != DayOfWeek.MONDAY) {
            return Optional.empty();
        }
        LocalDate weekStart = date.minusWeeks(1);
        return weeklyReviewRepository.findByCreatedByAndWeekStart(owner, weekStart).map(review ->
                new AnchoredEvent(NotificationCategory.WEEKLY_REVIEW, WEEKLY_REVIEW_MINUTE,
                        hhmm(WEEKLY_REVIEW_MINUTE), "Mezo · heti elemzés", excerptProse(review.getSummary()),
                        "/me/week?start=" + weekStart));
    }

    private Optional<AnchoredEvent> memoirAnchor(UUID owner, LocalDate date) {
        if (date.getDayOfWeek() != DayOfWeek.SUNDAY) {
            return Optional.empty();
        }
        LocalDate weekStart = date.minusDays(date.getDayOfWeek().getValue() - 1L); // this week's ISO Monday
        return memoirRepository.findByCreatedByAndWeekStart(owner, weekStart).map(memoir -> {
            int minute = anchorAfterGeneration(MEMOIR_PREFERRED_MINUTE,
                    proactiveProperties.memoir().cron(), date);
            return new AnchoredEvent(NotificationCategory.MEMOIR, minute, hhmm(minute),
                    "Mezo · a heted története", excerptProse(memoir.getBody()), URL_INSIGHTS_MEMOIR);
        });
    }

    /**
     * <b>Trap #6 — a prose anchor must never land on (or before) the minute its own content
     * generator runs.</b> Both jobs queue on the SAME size-1 scheduler thread and every generator
     * makes an LLM call, so at such a minute the content row provably does not exist yet; the prose
     * anchor only exists when the row exists, so the category would simply never fire — silently,
     * with nothing in the log to explain it. That was the shipped state of {@code memoir} (19:00
     * anchor vs {@code 0 0 19 * * SUN}) and {@code weekly} (wake anchor, default 06:00, vs
     * {@code 0 0 6 * * MON}), both {@code defaultEnabled = true}.
     *
     * <p>So: when {@code preferredMinute} lands at or before the generator's own fire minute on
     * {@code date}, the anchor moves to {@code generatorMinute + prose-generation-grace-min}
     * instead. The offset is <b>config</b> ({@code mezo.notification.prose-generation-grace-min}),
     * never a magic number — <b>do not "tidy" it away</b>, and do not hardcode 06:00/12:30/19:00
     * here: the generator's minute is read from the generator's OWN cron
     * ({@code mezo.proactive.*}) via {@link CronExpression}, the {@code CompanionMessageGenerator}
     * precedent, so the schedule keeps living in exactly one place.
     *
     * @param preferredMinute the anchor this category would use if there were no collision
     * @param generatorCron   the content generator's cron expression (from {@code mezo.proactive})
     * @return {@code preferredMinute}, or the graced post-generation minute when they collide
     */
    private int anchorAfterGeneration(int preferredMinute, String generatorCron, LocalDate date) {
        Integer generatorMinute = cronMinuteOfDay(generatorCron, date);
        if (generatorMinute == null || preferredMinute > generatorMinute) {
            return preferredMinute; // no same-day generation, or the anchor is already after it
        }
        return Math.min(generatorMinute + notificationProperties.proseGenerationGraceMin(), LAST_MINUTE_OF_DAY);
    }

    /** The generator's own fire minute on {@code date}, or {@code null} when its cron does not fire
     *  that day at all (e.g. a Sunday-only memoir cron asked about a Monday) — an honest "no
     *  collision is knowable", never a fabricated minute. */
    private static Integer cronMinuteOfDay(String generatorCron, LocalDate date) {
        LocalDateTime next = CronExpression.parse(generatorCron).next(date.atStartOfDay().minusNanos(1));
        return next == null || !next.toLocalDate().equals(date) ? null : minuteOfDay(next.toLocalTime());
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
            if (category == null || !category.feWritten()) {
                // An unrecognised — or a recognised-but-backend-native — category must never abort
                // resolution for the rest. The feWritten() half is defense-in-depth: today the only
                // way a row gets in is NotificationScheduleService.replace, which already rejects a
                // backend-native category (that endpoint is the security boundary, this is belt and
                // braces for a row that arrived some other way, e.g. a manual DB fix).
                log.warn("Skipping notification_schedule row with a non-FE-written category '{}'", entry.category());
                continue;
            }
            int minuteOfDay;
            try {
                minuteOfDay = minuteOfDay(entry.time());
            } catch (DateTimeParseException e) {
                // The SAME defense the category above gets, and for the same reason: one malformed
                // `time` used to throw out of resolve() BEFORE any anchor was returned, so the
                // dispatcher's per-user catch logged a stack trace 1440x/day and that user received
                // NOTHING at all, from any category, forever. The contract only constrains this to
                // 5 chars (so "aa:bb" validates) and there is no DB CHECK — so guard it here.
                log.warn("Skipping notification_schedule row with unparseable time '{}' (category '{}')",
                        entry.time(), entry.category());
                continue;
            }
            events.add(new AnchoredEvent(category, minuteOfDay, entry.time(),
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

    private static String hhmm(int minuteOfDay) {
        return String.format("%02d:%02d", minuteOfDay / 60, minuteOfDay % 60);
    }
}

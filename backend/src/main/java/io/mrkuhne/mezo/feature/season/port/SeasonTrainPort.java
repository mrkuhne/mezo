package io.mrkuhne.mezo.feature.season.port;

import io.mrkuhne.mezo.feature.season.entity.SeasonDraftJson;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** What the season needs from training (consumer-owned port): the weekly slots, their energy, the block. */
public interface SeasonTrainPort {

    /** The current weekly rhythm in the draft's shape. {@code gymTime} = the time every gym slot shares, or null when
     *  they differ (or there is none). */
    record Schedule(List<Integer> gymDays, String gymTime, List<SeasonDraftJson.SportSlot> sport) {
    }

    /** One kind of planned session; a day may carry several (gym and sport = two sessions). Gym and run are the
     *  training side, sport the sport side. Two slots of the same kind on one day are still one session. */
    enum SessionKind {
        GYM, SPORT, RUN;

        public String key() {
            return name().toLowerCase(java.util.Locale.ROOT);
        }

        public boolean training() {
            return this != SPORT;
        }
    }

    record Block(UUID id, String title, String status, LocalDate startDate, LocalDate endDate, int weeks,
                 List<String> phaseCurve) {
    }

    /** A training change on a day (Évad S4 experiment overlaps): a block started (MESOCYCLE), a deload week of a
     *  block began (DELOAD), a kímélő period began (KIMELO). */
    record TrainEvent(TrainEventKind kind, LocalDate date) {
    }

    enum TrainEventKind { MESOCYCLE, DELOAD, KIMELO }

    Schedule currentSchedule(UUID owner);

    /** The draft's gym + sport weekly EAT (kcal/day) at the given rest energy — pure. */
    BigDecimal draftEat(SeasonDraftJson draft, BigDecimal restKcalPerHour);

    /** Net kcal one planned training day credits under the draft (a gym session; sport when no gym day). */
    int trainDayMovementKcal(SeasonDraftJson draft, BigDecimal restKcalPerHour);

    /** Net kcal each weekday (0 = hétfő … 6) credits under the draft: its gym session plus every sport slot that day —
     *  a gym + sport day credits both. Seven values. */
    List<Integer> weekdayMovementKcal(SeasonDraftJson draft, BigDecimal restKcalPerHour);

    /** The largest movement of a weekday carrying both a gym and a sport session; empty when the draft has none. */
    Optional<Integer> trainSportDayMovementKcal(SeasonDraftJson draft, BigDecimal restKcalPerHour);

    /** Replaces both weekly schedules with the draft's (each replace recomputes the active goal). */
    void replaceSlots(UUID owner, SeasonDraftJson draft);

    Optional<Block> activeMesocycle(UUID owner);

    /** One day of a block's re-arranged week (mezo-r36n9.122): {@code change} keep | move | add | drop. */
    record BlockDay(int weekday, String title, String change, Integer fromWeekday) {
    }

    /** A running block laid onto new gym days: the new week, and the days that leave it. */
    record BlockWeek(UUID mesocycleId, String title, List<BlockDay> days, List<BlockDay> dropped) {
    }

    /**
     * The block's week re-arranged onto {@code gymDays} (0 = hétfő), judged with the draft's sport days — the train
     * feature's choice of which day moves, repeats or drops. Empty when nothing would change. No write.
     */
    Optional<BlockWeek> blockRearrangement(UUID owner, UUID mesocycleId, List<Integer> gymDays, Set<Integer> sportDays);

    /** Writes the re-arrangement {@link #blockRearrangement} shows for the same state. */
    void rearrangeBlock(UUID owner, UUID mesocycleId, List<Integer> gymDays, Set<Integer> sportDays);

    /** The block's days and exercises as text, for the preview fingerprint. */
    String blockState(UUID owner, UUID mesocycleId);

    Optional<Block> mesocycle(UUID owner, UUID mesocycleId);

    /** Starts an active block from a template on {@code startDate}; returns the new mesocycle id. */
    UUID startFromTemplate(UUID owner, UUID templateId, LocalDate startDate);

    /** The template a mesocycle can be re-run from (materialised for a legacy run). */
    UUID templateOf(UUID owner, UUID mesocycleId);

    /**
     * The planned sessions per day of {@code from..to}: a weekly gym slot on that weekday (GYM), a weekly sport slot
     * (SPORT) — the schedule as it stands — and a run the running block plans that day (RUN). Days without any are
     * absent.
     */
    Map<LocalDate, Set<SessionKind>> plannedSessions(UUID owner, LocalDate from, LocalDate to);

    /** The done sessions per day: a completed gym workout (GYM), a logged sport session (SPORT), a logged run (RUN). */
    Map<LocalDate, Set<SessionKind>> doneSessions(UUID owner, LocalDate from, LocalDate to);

    /** The sessions skipped with an excusing reason, per day and kind. */
    Map<LocalDate, Set<SessionKind>> excusedSessions(UUID owner, LocalDate from, LocalDate to);

    /**
     * The training changes inside {@code from..to}, oldest first: each block that started then, each deload week of
     * a block that began then, and each kímélő period that was on then (dated its first day inside the range).
     */
    List<TrainEvent> trainEvents(UUID owner, LocalDate from, LocalDate to);
}

package io.mrkuhne.mezo.feature.character.detector;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** A 14-day read-only slice of the user's data ending at {@code day} (the observed day). */
public record DetectorInput(LocalDate day,
                            Set<LocalDate> mealDates,
                            Map<LocalDate, Integer> checkinCounts,
                            List<WeightPoint> weights,
                            Map<LocalDate, List<String>> journalTexts,
                            List<GymDay> gymDays,
                            List<SportPoint> sportSessions,
                            List<RunPoint> runLogs,
                            List<SleepPoint> sleepPoints,
                            MesoContext meso,
                            TrendWindow trend) {
    public record WeightPoint(LocalDate date, BigDecimal kg) {}
    /** One completed gym instance day with per-exercise aggregates (working sets only). */
    public record GymDay(LocalDate date, List<ExerciseWork> exercises) {}
    /** Per-exercise aggregate for one session. Nullable aggregates mean "no data", never zero. */
    public record ExerciseWork(String exerciseName,
                               int workingSets,
                               int skippedSets,
                               List<SetPoint> sets,
                               Integer worstJointPain,
                               Integer pump,
                               Integer workload) {}
    /** One logged working set, ordered by setIndex. Nullable fields were not logged. */
    public record SetPoint(int setIndex, BigDecimal weightKg, Integer reps, Integer rir,
                           BigDecimal targetWeightKg, Integer targetReps, boolean skipped) {}
    public record SportPoint(LocalDate date, String sport, BigDecimal rpe,
                             Integer shoulderStrain, Integer jumpCount, Integer intensity) {}
    public record RunPoint(LocalDate date, Integer rpeActual, Integer hrRecoverySec,
                           Integer completedRounds) {}
    /** date = the night leading into that day (companion "last night" convention); bedtime/wakeup are the
     *  row's HH:mm clock strings parsed to LocalTime, null when absent or malformed (round 4). */
    public record SleepPoint(LocalDate date, Integer quality, BigDecimal durationH, Integer awakenings,
                             LocalTime bedtime, LocalTime wakeup) {}
    /** Active mesocycle context; null when no active meso. plannedDays from gym schedule slots. */
    public record MesoContext(String title, int currentWeek, int totalWeeks, boolean deloadWeek,
                              Set<DayOfWeek> plannedDays, Set<LocalDate> doneDays) {}
    /** One day's meal aggregate. kcal/macros are sums over the day's meal item snapshots.
     *  {@code nova4KcalShare} is null ONLY when ZERO of the day's kcal carries a NOVA class —
     *  a share computed from nothing would be a fabrication. A non-null share therefore does NOT
     *  mean the day's coverage is trustworthy: {@code novaCoveragePct} carries the coverage and
     *  the minimum-coverage gate lives detector-side ({@code ComfortEatingDetector.MIN_NOVA_COVERAGE}).
     *  Any new consumer of {@code nova4KcalShare} must apply its own coverage gate the same way. */
    public record MealDayPoint(LocalDate date,
                               BigDecimal kcal,
                               BigDecimal proteinG,
                               BigDecimal carbsG,
                               BigDecimal fatG,
                               BigDecimal nova4KcalShare,
                               BigDecimal novaCoveragePct,
                               BigDecimal kcalTarget,
                               BigDecimal proteinTarget,
                               List<MealPoint> meals) {}

    /** One logged meal. {@code loggedAtLocalTime} is {@code loggedAt} in the JVM default zone —
     *  the same clock the character jobs take {@code LocalDate.now()} from. */
    public record MealPoint(String slot, LocalTime loggedAtLocalTime, BigDecimal kcal, Integer nova) {}

    /** A day with at least one water log; an absent date means "not logged", never 0 ml. */
    public record WaterDayPoint(LocalDate date, int amountMl, int targetMl) {}

    /** The active supplement protocol plus per-day intake facts; null when no active protocol. */
    public record StackContext(List<StackItem> items, List<StackDayPoint> days) {}
    /** One planned protocol item. {@code restDayFallback} is a zone key or null (null = the item
     *  is deliberately dropped on a rest day rather than displaced).
     *
     *  <p>{@code startedOn} is the day the item entered the protocol (its {@code createdAt} in the
     *  JVM default zone — the same clock convention the rest of this read layer uses). Compliance
     *  must never be scored against a day that PREDATES the item: a day before {@code startedOn}
     *  is absent, not a skip (spec §4.3, at the item-day level). Null means the start is unknown,
     *  in which case no lower bound is applied. */
    public record StackItem(UUID pantryItemId, String name, String slotKey, String restDayFallback,
                            LocalDate startedOn) {}
    public record StackDayPoint(LocalDate date, Set<UUID> takenPantryItemIds) {}

    /** Per-day means of the day's logged check-in slots; a null scale means nobody logged it.
     *  energy/body/mental: higher = better. stress: higher = worse. All 1..10. */
    public record CheckinDayPoint(LocalDate date, int count,
                                  BigDecimal energy, BigDecimal stress,
                                  BigDecimal body, BigDecimal mental) {}

    /** Active medication cycle context; null when the owner has no active medication. */
    public record MedContext(int cycleLengthDays, List<MedCycleDayPoint> days) {}
    /** One day projected onto the medication cycle. {@code stale} marks a day whose last dose is
     *  older than one full cycle — {@code MedicationCycleService} CLAMPS those to the last cycle
     *  day for the Fuel UI, which would pile no-dose weeks into one bucket, so covariance drops
     *  them. {@code daysSinceDose} is the true (unclamped) distance in days from the last dose's
     *  administered date; it is never null on a day that appears here at all, because a day with
     *  no dose at or before it is OMITTED from the list rather than carried with a null distance
     *  (absent, not zero). It is declared as a boxed {@code Integer} only so a future read path
     *  that does carry such days has somewhere to say so. */
    public record MedCycleDayPoint(LocalDate date, int cycleDay, String phaseKey,
                                   Integer daysSinceDose, boolean stale) {}

    /** One day of the intention loop. {@code focusCount} is how many foci were set that morning;
     *  {@code reflection} is the evening day-close verdict ("yes"/"partial"/"no" — the
     *  {@code DailyIntentionEntity.REFLECTION_*} values) or null when the day was never closed.
     *  A day with neither a focus nor a reflection is OMITTED, never carried as a zero row. */
    public record IntentionDayPoint(LocalDate date, int focusCount, String reflection) {}

    /** One decision-journal entry. {@code writtenOn} is {@code createdAt} in the JVM default zone;
     *  {@code reviewedOn} is {@code reviewedAt} in the same zone, or null when not yet reviewed.
     *  {@code outcomeRating} is the 1..5 scale, null until reviewed. {@code textPreview} is the raw
     *  decision text truncated for EVIDENCE only — no detector may parse or interpret it. */
    public record DecisionPoint(LocalDate decidedOn, LocalDate writtenOn, LocalDate reviewDue,
                                LocalDate reviewedOn, Short outcomeRating, String textPreview) {}

    /** One gratitude entry. {@code lifeArea} is the closed tag (mindfulness|mindset|cooking|
     *  financial|productivity|learning|connection|recovery) or null when the user left it off —
     *  null is "untagged", never a category. */
    public record GratitudePoint(LocalDate occurredOn, LocalDate writtenOn, String lifeArea) {}

    /** The Életjel (needs) day series plus the domain threshold that defines "green"; null when the
     *  owner has never closed a day. {@code greenThreshold} is carried because a detector may not
     *  read configuration — it mirrors {@code NeedsProperties.greenThreshold}, exactly as round 2
     *  carried the macro targets rather than re-deriving them. */
    public record NeedsContext(int greenThreshold, List<NeedsDayPoint> days) {}

    /** One closed Életjel day. The six domains are 0..100. {@code streakDays} is the streak as of
     *  THAT day, snapshotted by {@code NeedsService.closeNew} — the only per-day streak history in
     *  the system ({@code GamificationProfileEntity} carries live state only). An unclosed day has
     *  NO row here; per the domain's own rule that is a streak break, not a zero. */
    public record NeedsDayPoint(LocalDate date, int energia, int hidratacio, int pihenes,
                                int mozgas, int lelek, int rend, int greenCount,
                                boolean allGreen, int streakDays) {}

    /** One check-in ROW (not a day aggregate — {@link CheckinDayPoint} carries the scales).
     *  {@code slotTime} is the slot label stored on the row itself ("HH:mm"), which is the only
     *  historically-faithful nominal time available: {@code notification_schedule} is replaced
     *  wholesale on every save and has no history. {@code writtenAt} is {@code createdAt} in the
     *  JVM default zone — deliberately NOT {@code savedAt}, which every edit moves forward.
     *  {@code notePreview} is the raw note truncated for EVIDENCE only, or null. */
    public record CheckinSlotPoint(LocalDate date, String slotTime, LocalDateTime writtenAt,
                                   String notePreview) {}

    /** One logged record's "the day it is about" vs "the day it was written" pair.
     *  {@code genre} is {@code "esemeny"} (gym, run, sport, weight, sleep, meal) or
     *  {@code "reflexio"} (check-in, journal, gratitude, decision, focus); {@code source} names the
     *  entity for debugging. Same-day is the literature's "live logging" boundary; anything later
     *  is retrospective (round-3 spec §2). */
    public record LogLatencyPoint(String genre, String source, LocalDate aboutDate,
                                  LocalDate writtenDate) {}

    /** One people mention. {@code contextLabel} is the people feature's nightly classifier output
     *  (closed DB-CHECK set) or null = unlabelled — never "egyeb". tone/intensity are deliberately
     *  NOT carried (round-4 spec §4.4): the mood side is the user's own check-in scale. */
    public record MentionPoint(LocalDate date, UUID personId, String contextLabel, boolean flagged) {}
    /** One executed companion tool call (assistant row). {@code titlePreview} is the conversation
     *  title (= the first user message, truncated) for EVIDENCE only — never parsed. */
    public record ChatToolCallPoint(LocalDate date, UUID conversationId, String toolName, String titlePreview) {}
    /** One Tudástár triage decision. source = "fact" (LearnedFact, date = the candidate's createdAt —
     *  a PROXY, there is no decidedAt) or "pattern" (PatternEvent confirmed|rejected, date = occurredAt).
     *  decision = "kept" | "rejected"; refined = the fact was accepted with an edit. */
    public record TriageDecisionPoint(LocalDate date, String source, String category, String decision,
                                      boolean refined) {}
    public record PredictionPoint(LocalDate validFrom, LocalDate validTo, String status,
                                  BigDecimal confidence, String metricKey) {}
    public record QuestPoint(LocalDate questDate, String slot, String status) {}
    /** kind = "experiment" (date = generatedAt) | "challenge" (date = workoutDate); status is the
     *  source row's own status string; outcomeGood null = no verdict recorded. */
    public record ProposalOutcomePoint(LocalDate date, String kind, String status, Boolean outcomeGood) {}
    /** The system-side (AI-meta) series, gathered by {@code CharacterMetaReads}. */
    public record MetaWindow(List<TriageDecisionPoint> triageDecisions, List<PredictionPoint> predictions,
                             List<QuestPoint> quests, List<ProposalOutcomePoint> proposalOutcomes) {
        public static MetaWindow empty() {
            return new MetaWindow(List.of(), List.of(), List.of(), List.of());
        }
    }

    /** Raw 8-week series ending at day — detectors aggregate these themselves so they can
     *  recompute their state both as-of day and as-of day-1 (stateless state-change gate).
     *  Round-2 and round-3 series live ONLY here: every such detector windows them by an
     *  {@code asOf} parameter, so a duplicated shorter copy would be dead weight. Round 3's
     *  episodic sources use longer windows (decisions 42 days, gratitude and restart 28 days),
     *  which is why they need the full 8 weeks rather than 14 days.
     *
     *  <p>{@code sleepEightWeeks} widens the existing 14-day {@code sleepPoints} slice for the same
     *  reason: {@code self-calibration} evaluates its state as of day AND as of day-1, and a
     *  14-day slice would leave the day-1 window one day short — the state could then change
     *  because a day fell off the end rather than because the behaviour changed.
     *
     *  <p>Round 4 adds the people mentions, the assistant tool-call series and the nested
     *  {@code MetaWindow} (system-side sources, gathered by {@code CharacterMetaReads}). */
    public record TrendWindow(List<RunPoint> runsEightWeeks, List<GymDay> gymEightWeeks,
                              List<MealDayPoint> mealDays, List<WaterDayPoint> waterDays,
                              StackContext stack, List<CheckinDayPoint> checkinDays,
                              MedContext med,
                              List<SleepPoint> sleepEightWeeks,
                              List<IntentionDayPoint> intentionDays,
                              List<DecisionPoint> decisions,
                              List<GratitudePoint> gratitudes,
                              NeedsContext needs,
                              List<CheckinSlotPoint> checkinSlots,
                              List<LocalDateTime> userChatTimes,
                              List<LogLatencyPoint> logLatencies,
                              List<MentionPoint> mentions,
                              List<ChatToolCallPoint> chatToolCalls,
                              MetaWindow meta) {}
}
